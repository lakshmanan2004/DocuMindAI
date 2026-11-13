const path = require('path');
const { Document, DocumentPage, Template, Extraction } = require('../models');
const { extractDocumentText } = require('../services/text');
const { extractWithLlama } = require('../services/llm');
const { validateExtraction } = require('../services/validate');
const { scoreConfidence } = require('../services/confidence');
const { uploadDirectory } = require('../middleware/upload');

/**
 * End-to-end processing pipeline for a single document:
 * 1. Status -> 'processing'
 * 2. Extract page text (OCR or PDF Parse) -> save DocumentPage records
 * 3. Structured LLM extraction against Template (Invoice, Agreement, etc.)
 * 4. Business rule validation (GSTIN format, line items, duplicate invoices)
 * 5. Confidence scoring (0 to 1) and source snippet localization
 * 6. Status -> 'needs_review' (if low confidence or issues) or 'completed'
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

    // 3. Template & LLM Extraction (Phase 3)
    let template = null;
    if (doc.templateId) {
      template = await Template.findById(doc.templateId);
    }
    if (!template) {
      // Default to the first available template in the organization (e.g. Invoice)
      template = await Template.findOne({ orgId: doc.orgId });
    }

    if (template && template.fields.length > 0) {
      console.log(`[Queue Worker] Applying template '${template.name}' for document ${doc.originalName}`);
      const fullText = extractedPages.map((p) => p.text).join('\n\n');

      // AI extraction via Ollama (or resilient pattern extractor)
      const rawExtracted = await extractWithLlama(fullText, template);

      // Business rule validation
      const validationIssues = await validateExtraction(rawExtracted, doc.orgId, doc._id);

      // Score confidence and link to source page
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
        { upsert: true, new: true }
      );

      // Flag for review if a required field is missing, an extracted field has low confidence, or validation failed
      const hasLowConfidence = scoredFields.some((f) => {
        const fieldDef = template.fields.find((tf) => tf.key === f.key);
        const isRequired = fieldDef ? fieldDef.required : false;
        // If an optional field (e.g. GSTIN on non-tax bills) is absent, do not penalize the document
        if (!isRequired && (f.value === null || f.value === undefined || f.value === '')) {
          return false;
        }
        return f.confidence < 0.7;
      });

      if (hasLowConfidence || validationIssues.length > 0) {
        doc.status = 'needs_review';
        console.log(`[Queue Worker] Flagged document as 'needs_review' (issues: ${validationIssues.length})`);
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
