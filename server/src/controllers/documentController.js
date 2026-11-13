const path = require('path');
const fs = require('fs');
const { Document, DocumentPage, Extraction, Template } = require('../models');
const { uploadDirectory } = require('../middleware/upload');
const { addDocumentJob } = require('../queues/docQueue');
const { validateExtraction } = require('../services/validate');

/**
 * @desc    Upload a new document (PDF, PNG, JPG) and enqueue for background processing
 * @route   POST /api/documents
 * @access  Private (Admin, Employee, Reviewer)
 */
const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Please attach a document.' });
    }

    const { templateId } = req.body;

    const doc = await Document.create({
      orgId: req.user.orgId,
      uploadedBy: req.user.id,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      filePath: req.file.filename,
      size: req.file.size,
      templateId: templateId || null,
      status: 'queued'
    });

    await addDocumentJob(doc._id);

    return res.status(201).json({
      message: 'Document uploaded and queued for processing',
      document: doc
    });
  } catch (error) {
    if (req.file) {
      const fullPath = path.join(uploadDirectory, req.file.filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
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
    const { status, search, page = 1, limit = 20 } = req.query;

    const query = { orgId: req.user.orgId };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.originalName = { $regex: search.trim(), $options: 'i' };
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
      .populate('templateId', 'name fields');

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    return res.status(200).json({ document: doc });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get extracted text pages for a document
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
      .populate('templateId', 'name fields')
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
    const { fields } = req.body; // Array of { key, value }

    if (!fields || !Array.isArray(fields)) {
      return res.status(400).json({ message: 'Fields array is required' });
    }

    const extraction = await Extraction.findOne({
      documentId: req.params.id,
      orgId: req.user.orgId
    });

    if (!extraction) {
      return res.status(404).json({ message: 'Extraction not found' });
    }

    // Update fields and mark edited = true, confidence = 1.0 (verified by human)
    const updatedValuesMap = {};
    for (const update of fields) {
      const target = extraction.fields.find((f) => f.key === update.key);
      if (target) {
        if (target.value !== update.value) {
          target.value = update.value;
          target.edited = true;
          target.confidence = 1.0;
        }
      }
      updatedValuesMap[update.key] = update.value;
    }

    // Re-run validations with the new human-corrected values
    const newValidationIssues = await validateExtraction(
      updatedValuesMap,
      req.user.orgId,
      req.params.id
    );
    extraction.validationIssues = newValidationIssues;

    await extraction.save();

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

    // Mark extraction as reviewed by current user
    extraction.reviewedBy = req.user.id;
    extraction.reviewedAt = new Date();
    await extraction.save();

    // Mark document status as 'reviewed'
    doc.status = 'reviewed';
    await doc.save();

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
 * @desc    Reprocess a failed or stuck document
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

    doc.status = 'queued';
    doc.errorMessage = null;
    await doc.save();

    await addDocumentJob(doc._id);

    return res.status(200).json({
      message: 'Document enqueued for reprocessing',
      document: doc
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Stream or preview a document file
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
 * @desc    Delete a document and its stored file, pages, and extractions
 * @route   DELETE /api/documents/:id
 * @access  Private (Admin, or Employee who uploaded it)
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

    const isOwner = doc.uploadedBy.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        message: 'Forbidden: You can only delete documents that you uploaded'
      });
    }

    // Remove file from disk
    const fullPath = path.join(uploadDirectory, doc.filePath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.warn(`[Warning] Could not remove file on disk: ${fullPath}`, err.message);
      }
    }

    // Delete associated pages, extractions, and document record
    await DocumentPage.deleteMany({ documentId: doc._id });
    await Extraction.deleteMany({ documentId: doc._id });
    await Document.deleteOne({ _id: doc._id });

    return res.status(200).json({
      message: 'Document deleted successfully',
      deletedId: doc._id
    });
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
  deleteDocument
};
