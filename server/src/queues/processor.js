const path = require('path');
const { Document, DocumentPage, Template, Extraction, Chunk } = require('../models');
const { extractDocumentText } = require('../services/text');
const { extractWithLlama, classifyDocument } = require('../services/llm');
const { validateRules } = require('../services/validate');
const { scoreConfidence } = require('../services/confidence');
const { chunkDocumentPages } = require('../services/chunk');
const { embedTexts } = require('../services/embed');
const { uploadDirectory } = require('../middleware/upload');
const { genericTemplate } = require('../seed/templates');

/**
 * End-to-end processing pipeline for a single document:
 * 1. Status -> 'processing'
 * 2. Extract page text (OCR or PDF Parse) -> save DocumentPage records
 * 3. Auto-classify document type (or honor user-selected templateId)
 * 4. Chunk & Embed document pages into Atlas vector search (for RAG)
 * 5. Structured LLM extraction against template fields (windowed if > 12k chars)
 * 6. Generic business rule validation (validateRules)
 * 7. Confidence scoring and source page localization (scoreConfidence)
 * 8. Status -> 'needs_review' (if low confidence or errors) or 'completed'
 *
 * @param {string} documentId - MongoDB ID of the document
 */
const processDocument = async (documentId) => {
  console.log(`[Queue Worker] Starting pipeline for document: ${documentId}`);

  const doc = await Document.findById(documentId);
  if (!doc) {
    console.error(`[Queue Worker Error] Document ${documentId} not found`);
    return;
  }

  try {
    // 1. Status -> processing
    doc.status = 'processing';
    doc.errorMessage = null;
    await doc.save();

    // 2. Extract text page-by-page
    const fullPath = path.join(uploadDirectory, doc.filePath);
    const extractedPages = await extractDocumentText(fullPath, doc.mimeType);

    // Save DocumentPage records
    await DocumentPage.deleteMany({ documentId: doc._id });
    if (extractedPages.length > 0) {
      const pageDocs = extractedPages.map((p) => ({
        orgId: doc.orgId,
        documentId: doc._id,
        pageNumber: p.pageNumber,
        text: p.text,
        ocrConfidence: p.ocrConfidence
      }));
      await DocumentPage.insertMany(pageDocs);
    }

    doc.pageCount = extractedPages.length;
    const fullText = extractedPages.map((p) => p.text).join('\n\n');

    // 3. Chunk & Embed Document Pages for Vector Search (Phase 4 RAG)
    try {
      const pageChunks = chunkDocumentPages(extractedPages, 800, 120);
      if (pageChunks.length > 0) {
        console.log(`[Queue Worker] Generating embeddings for ${pageChunks.length} chunks of document: ${doc.originalName}`);
        const chunkTexts = pageChunks.map((c) => c.text);
        const embeddings = await embedTexts(chunkTexts);

        // Remove old chunks if reprocessing
        await Chunk.deleteMany({ documentId: doc._id });

        const chunkRecords = pageChunks.map((c, idx) => ({
          orgId: doc.orgId,
          documentId: doc._id,
          pageNumber: c.pageNumber,
          chunkIndex: c.chunkIndex,
          text: c.text,
          embedding: embeddings[idx]
        }));

        await Chunk.insertMany(chunkRecords);
        console.log(`[Queue Worker] Saved ${chunkRecords.length} vector chunks to Atlas for: ${doc.originalName}`);
      }
    } catch (embedError) {
      console.warn(`[Queue Worker] Warning: Failed to embed document chunks for ${doc.originalName}:`, embedError.message);
    }

    // 4. Auto-Classification or User Selected Template
    let template = null;
    if (doc.templateId) {
      template = await Template.findOne({ _id: doc.templateId, orgId: doc.orgId });
    }

    if (!template) {
      // Auto-classify document against all templates in the organization
      const orgTemplates = await Template.find({ orgId: doc.orgId });
      const classification = await classifyDocument(fullText, orgTemplates);
      console.log(`[Queue Worker] Auto-classification result: ${classification.templateName} (${classification.confidence})`);

      doc.classificationConfidence = classification.confidence;

      if (classification.templateId) {
        template = orgTemplates.find((t) => t._id.toString() === classification.templateId);
        if (template) {
          doc.templateId = template._id;
          doc.docType = template.name;
        }
      }

      // If confidence < 0.5 or no match, fall back to 'Other' template
      if (!template) {
        let otherTmpl = await Template.findOne({ orgId: doc.orgId, name: 'Other' });
        if (!otherTmpl) {
          otherTmpl = await Template.create({
            orgId: doc.orgId,
            ...genericTemplate,
            createdBy: doc.uploadedBy
          });
        }
        template = otherTmpl;
        doc.templateId = otherTmpl._id;
        doc.docType = 'Other';
      }
    } else {
      doc.docType = template.name;
    }

    // 5. Structured LLM Extraction
    if (template && template.fields && template.fields.length > 0) {
      console.log(`[Queue Worker] Extracting fields for template '${template.name}' on ${doc.originalName}`);

      const rawExtracted = await extractWithLlama(fullText, template);

      // 6. Generic Business Rule Validation
      const validationIssues = await validateRules(rawExtracted, template.rules || [], {
        Document,
        orgId: doc.orgId,
        documentId: doc._id
      });

      // 7. Score Confidence & Source Snippet Localization
      const scoredFields = scoreConfidence(
        template.fields,
        rawExtracted,
        extractedPages,
        validationIssues
      );

      // Save Extraction record
      await Extraction.findOneAndUpdate(
        { orgId: doc.orgId, documentId: doc._id },
        {
          orgId: doc.orgId,
          documentId: doc._id,
          templateId: template._id,
          fields: scoredFields,
          validationIssues,
          reviewedBy: null,
          reviewedAt: null
        },
        { upsert: true, returnDocument: 'after' }
      );

      // 8. Document Status Determination
      const hasErrors = validationIssues.some((i) => i.severity === 'error');
      const hasLowConfidence = scoredFields.some((f) => {
        const fieldDef = template.fields.find((tf) => tf.key === f.key);
        const isRequired = fieldDef ? fieldDef.required : false;
        if (!isRequired && (f.value === null || f.value === undefined || f.value === '')) {
          return false;
        }
        return f.confidence < 0.60;
      });

      if (hasErrors || hasLowConfidence) {
        doc.status = 'needs_review';
        console.log(`[Queue Worker] Document flagged as 'needs_review' (errors: ${hasErrors}, low confidence: ${hasLowConfidence})`);
      } else {
        doc.status = 'completed';
      }
    } else {
      doc.status = 'completed';
    }

    doc.errorMessage = null;
    await doc.save();

    console.log(`[Queue Worker] Pipeline finished for doc: ${doc.originalName} with status: ${doc.status}`);
  } catch (error) {
    console.error(`[Queue Worker Failed] Document: ${documentId}`, error);
    doc.status = 'failed';
    doc.errorMessage = error.message;
    await doc.save();
  }
};

module.exports = {
  processDocument
};
