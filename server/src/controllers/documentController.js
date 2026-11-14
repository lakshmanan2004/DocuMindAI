const path = require('path');
const fs = require('fs');
const { Document, DocumentPage, Extraction, Template, Chunk, User, Folder } = require('../models');
const { uploadDirectory } = require('../middleware/upload');
const { addDocumentJob } = require('../queues/docQueue');
const { validateRules } = require('../services/validate');
const { recordAudit } = require('../services/audit');
const { validateFileSignature } = require('../utils/fileSignature');

/**
 * @desc    Upload single or multiple documents and enqueue for background processing
 *          Validates file signatures (magic bytes) and checks orgId (Spec M2)
 * @route   POST /api/documents
 * @access  Private (Admin, Employee, Reviewer)
 */
const uploadDocument = async (req, res, next) => {
  const uploadedFiles = req.files && req.files.length > 0 ? req.files : req.file ? [req.file] : [];

  if (uploadedFiles.length === 0) {
    return res.status(400).json({ message: 'No file uploaded. Please attach at least one document.' });
  }

  const { templateId, folderId } = req.body;
  const createdDocs = [];

  try {
    // 1. Verify Folder (if provided) belongs to this organization
    let validFolderId = null;
    if (folderId && folderId !== 'null' && folderId !== 'none') {
      const folder = await Folder.findOne({ _id: folderId, orgId: req.user.orgId });
      if (folder) validFolderId = folder._id;
    }

    // 2. Verify Template (if provided) belongs to this organization
    let validTemplateId = null;
    let templateName = 'Other';
    if (templateId && templateId !== 'null' && templateId !== 'none') {
      const tmpl = await Template.findOne({ _id: templateId, orgId: req.user.orgId });
      if (tmpl) {
        validTemplateId = tmpl._id;
        templateName = tmpl.name;
      }
    }

    // 3. Process each uploaded file
    for (const file of uploadedFiles) {
      const fullPath = path.join(uploadDirectory, file.filename);

      // Validate magic bytes
      const detectedMime = validateFileSignature(fullPath);
      if (!detectedMime) {
        // Remove corrupted or invalid file from disk
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        return res.status(400).json({
          message: `File '${file.originalname}' has an invalid or corrupted file signature. Only authentic PDF, PNG, and JPEG files are permitted.`
        });
      }

      const doc = await Document.create({
        orgId: req.user.orgId,
        uploadedBy: req.user.id,
        folderId: validFolderId,
        templateId: validTemplateId,
        docType: validTemplateId ? templateName : 'Other',
        originalName: file.originalname,
        mimeType: detectedMime,
        filePath: file.filename,
        size: file.size,
        status: 'queued'
      });

      // Enqueue job for background processing worker
      await addDocumentJob(doc._id);
      createdDocs.push(doc);

      // Record audit event
      await recordAudit({
        orgId: req.user.orgId,
        userId: req.user.id,
        userName: req.user.name || 'User',
        userRole: req.user.role,
        action: 'upload',
        targetType: 'document',
        targetId: doc._id.toString(),
        details: { fileName: doc.originalName, size: doc.size, mimeType: doc.mimeType }
      });
    }

    return res.status(201).json({
      message: `${createdDocs.length} document(s) uploaded and queued for processing`,
      documents: createdDocs,
      document: createdDocs[0] // backward compatibility for single-upload callers
    });
  } catch (error) {
    // Clean up any files written to disk during this failed request
    for (const file of uploadedFiles) {
      const fullPath = path.join(uploadDirectory, file.filename);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) {}
      }
    }
    next(error);
  }
};

/**
 * @desc    List all documents for the authenticated tenant with filter & search
 * @route   GET /api/documents
 * @access  Private (All roles)
 */
const getDocuments = async (req, res, next) => {
  try {
    const {
      status,
      docType,
      folderId,
      startDate,
      endDate,
      q,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const query = { orgId: req.user.orgId };

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Document type / template filter
    if (docType && docType !== 'all') {
      query.docType = docType;
    }

    // Folder filter
    if (folderId) {
      if (folderId === 'null' || folderId === 'none' || folderId === 'unassigned') {
        query.folderId = null;
      } else if (folderId !== 'all') {
        query.folderId = folderId;
      }
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    // Name search query (supports 'q' or 'search')
    const searchTerm = q || search;
    if (searchTerm && searchTerm.trim()) {
      query.originalName = { $regex: searchTerm.trim(), $options: 'i' };
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [documents, total] = await Promise.all([
      Document.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('uploadedBy', 'name email role')
        .populate('templateId', 'name')
        .populate('folderId', 'name')
        .lean(),
      Document.countDocuments(query)
    ]);

    return res.status(200).json({
      documents,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single document by ID
 * @route   GET /api/documents/:id
 * @access  Private (All roles)
 */
const getDocumentById = async (req, res, next) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      orgId: req.user.orgId
    })
      .populate('uploadedBy', 'name email role')
      .populate('templateId', 'name fields rules')
      .populate('folderId', 'name');

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    return res.status(200).json({ document: doc });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get extracted text pages for a document (Spec M3)
 * @route   GET /api/documents/:id/pages
 * @access  Private (All roles)
 */
const getDocumentPages = async (req, res, next) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      orgId: req.user.orgId
    });

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const pages = await DocumentPage.find({
      documentId: doc._id,
      orgId: req.user.orgId
    }).sort({ pageNumber: 1 });

    return res.status(200).json({
      documentId: doc._id,
      pageCount: pages.length,
      pages
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get structured extraction, field confidence, and validation issues
 * @route   GET /api/documents/:id/extraction
 * @access  Private (All roles)
 */
const getDocumentExtraction = async (req, res, next) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      orgId: req.user.orgId
    });

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const extraction = await Extraction.findOne({
      documentId: doc._id,
      orgId: req.user.orgId
    })
      .populate('templateId', 'name fields rules')
      .populate('reviewedBy', 'name email');

    if (!extraction) {
      return res.status(404).json({ message: 'No extraction data available for this document' });
    }

    return res.status(200).json({
      document: doc,
      extraction
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Save human review corrections to extracted fields
 * @route   PUT /api/documents/:id/extraction
 * @access  Private (Admin, Reviewer)
 */
const saveExtractionCorrections = async (req, res, next) => {
  try {
    const { fields } = req.body;

    const extraction = await Extraction.findOne({
      documentId: req.params.id,
      orgId: req.user.orgId
    });

    if (!extraction) {
      return res.status(404).json({ message: 'Extraction not found' });
    }

    if (fields && Array.isArray(fields)) {
      for (const updatedField of fields) {
        const existing = extraction.fields.find((f) => f.key === updatedField.key);
        if (existing) {
          existing.value = updatedField.value;
          existing.edited = true;
          existing.confidence = 1.0;
        } else {
          extraction.fields.push({
            key: updatedField.key,
            label: updatedField.label || updatedField.key,
            type: updatedField.type || 'string',
            value: updatedField.value,
            confidence: 1.0,
            sourcePage: 1,
            sourceText: '',
            edited: true
          });
        }
      }
    }

    // Re-evaluate template validation rules with corrected data
    const tmpl = await Template.findById(extraction.templateId);
    const valuesMap = {};
    for (const f of extraction.fields) {
      valuesMap[f.key] = f.value;
    }

    const refreshedIssues = await validateRules(valuesMap, tmpl?.rules || [], {
      Document,
      orgId: req.user.orgId,
      documentId: req.params.id
    });

    extraction.validationIssues = refreshedIssues;
    await extraction.save();

    await recordAudit({
      orgId: req.user.orgId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'edit',
      targetType: 'extraction',
      targetId: req.params.id,
      details: { fieldCount: fields?.length || 0 }
    });

    return res.status(200).json({
      message: 'Corrections saved successfully',
      extraction
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve document extraction
 * @route   POST /api/documents/:id/approve
 * @access  Private (Admin, Reviewer)
 */
const approveDocument = async (req, res, next) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      orgId: req.user.orgId
    });

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const extraction = await Extraction.findOne({
      documentId: doc._id,
      orgId: req.user.orgId
    });

    if (!extraction) {
      return res.status(404).json({ message: 'Cannot approve document without extraction data' });
    }

    extraction.reviewedBy = req.user.id;
    extraction.reviewedAt = new Date();
    await extraction.save();

    doc.status = 'reviewed';
    await doc.save();

    await recordAudit({
      orgId: req.user.orgId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'approve',
      targetType: 'document',
      targetId: doc._id.toString(),
      details: { fileName: doc.originalName }
    });

    return res.status(200).json({
      message: 'Document approved successfully',
      document: doc,
      extraction
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reprocess a document with optional new template
 * @route   POST /api/documents/:id/reprocess
 * @access  Private (Admin, Reviewer)
 */
const reprocessDocument = async (req, res, next) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      orgId: req.user.orgId
    });

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const { templateId } = req.body;
    if (templateId) {
      const tmpl = await Template.findOne({ _id: templateId, orgId: req.user.orgId });
      if (tmpl) {
        doc.templateId = tmpl._id;
        doc.docType = tmpl.name;
      }
    }

    // Reset status and clear error
    doc.status = 'queued';
    doc.errorMessage = null;
    await doc.save();

    // Clear old extraction, pages, and chunks for fresh reprocessing
    await Promise.all([
      DocumentPage.deleteMany({ documentId: doc._id }),
      Extraction.deleteMany({ documentId: doc._id }),
      Chunk.deleteMany({ documentId: doc._id })
    ]);

    await addDocumentJob(doc._id);

    await recordAudit({
      orgId: req.user.orgId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'reprocess',
      targetType: 'document',
      targetId: doc._id.toString(),
      details: { templateId: doc.templateId, fileName: doc.originalName }
    });

    return res.status(200).json({
      message: 'Document enqueued for reprocessing',
      document: doc
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Stream or preview a document file (Authenticated)
 * @route   GET /api/documents/:id/file
 * @access  Private (All roles)
 */
const getDocumentFile = async (req, res, next) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      orgId: req.user.orgId
    });

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const fullPath = path.join(uploadDirectory, doc.filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'File not found on storage disk' });
    }

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(doc.originalName)}"`
    );

    return res.sendFile(fullPath);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a single document and remove file, pages, chunks, extraction
 * @route   DELETE /api/documents/:id
 * @access  Private (Admin or Owner Employee)
 */
const deleteDocument = async (req, res, next) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      orgId: req.user.orgId
    });

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (req.user.role === 'reviewer' || req.user.role === 'viewer') {
      return res.status(403).json({
        message: 'Forbidden: Your role does not have permission to delete documents'
      });
    }

    const isOwner = doc.uploadedBy.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        message: 'Forbidden: Employees can only delete documents that they uploaded'
      });
    }

    // Remove file from disk
    const fullPath = path.join(uploadDirectory, doc.filePath);
    if (fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch (err) {}
    }

    // Cascade delete DB collections
    await Promise.all([
      DocumentPage.deleteMany({ documentId: doc._id }),
      Extraction.deleteMany({ documentId: doc._id }),
      Chunk.deleteMany({ documentId: doc._id }),
      Document.deleteOne({ _id: doc._id })
    ]);

    await recordAudit({
      orgId: req.user.orgId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'delete',
      targetType: 'document',
      targetId: doc._id.toString(),
      details: { fileName: doc.originalName }
    });

    return res.status(200).json({
      message: 'Document and all associated data deleted successfully',
      deletedId: doc._id
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Bulk delete documents
 * @route   POST /api/documents/bulk-delete
 * @access  Private (Admin or Owner Employee)
 */
const bulkDeleteDocuments = async (req, res, next) => {
  try {
    const { documentIds } = req.body;
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ message: 'documentIds array is required' });
    }

    if (req.user.role === 'reviewer' || req.user.role === 'viewer') {
      return res.status(403).json({
        message: 'Forbidden: Your role does not have permission to delete documents'
      });
    }

    const isAdmin = req.user.role === 'admin';
    const query = {
      _id: { $in: documentIds },
      orgId: req.user.orgId
    };

    if (!isAdmin) {
      query.uploadedBy = req.user.id;
    }

    const docsToDelete = await Document.find(query);
    const deletedIds = [];

    for (const doc of docsToDelete) {
      const fullPath = path.join(uploadDirectory, doc.filePath);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) {}
      }
      deletedIds.push(doc._id);
    }

    await Promise.all([
      DocumentPage.deleteMany({ documentId: { $in: deletedIds } }),
      Extraction.deleteMany({ documentId: { $in: deletedIds } }),
      Chunk.deleteMany({ documentId: { $in: deletedIds } }),
      Document.deleteMany({ _id: { $in: deletedIds } })
    ]);

    await recordAudit({
      orgId: req.user.orgId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'bulk_delete',
      targetType: 'document',
      targetId: deletedIds.join(','),
      details: { count: deletedIds.length }
    });

    return res.status(200).json({
      message: `${deletedIds.length} document(s) deleted successfully`,
      deletedIds
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get or generate AI summary for a document
 * GET /api/documents/:id/summary?format=short|detailed|executive
 */
const getDocumentSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const format = req.query.format || 'detailed';
    const regenerate = req.query.regenerate === 'true';

    const { generateDocumentSummary } = require('../services/summary');
    const result = await generateDocumentSummary({
      documentId: id,
      orgId: req.user.orgId,
      format,
      regenerate
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Regenerate AI summary for a document
 * POST /api/documents/:id/summary
 */
const createDocumentSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { format } = req.body;

    const { generateDocumentSummary } = require('../services/summary');
    const result = await generateDocumentSummary({
      documentId: id,
      orgId: req.user.orgId,
      format: format || 'detailed',
      regenerate: true
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadDocument,
  getDocuments,
  getDocumentById,
  getDocumentPages,
  getDocumentExtraction,
  saveExtractionCorrections,
  approveDocument,
  reprocessDocument,
  getDocumentFile,
  deleteDocument,
  bulkDeleteDocuments,
  getDocumentSummary,
  createDocumentSummary
};
