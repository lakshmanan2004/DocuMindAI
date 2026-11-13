const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader user ID is required'],
      index: true
    },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
      index: true
    },
    originalName: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required']
    },
    filePath: {
      type: String,
      required: [true, 'File path is required']
    },
    size: {
      type: Number,
      required: [true, 'File size is required']
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
      default: null,
      index: true
    },
    docType: {
      type: String,
      default: 'Other',
      index: true
    },
    classificationConfidence: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: {
        values: ['uploaded', 'queued', 'processing', 'completed', 'needs_review', 'failed', 'reviewed'],
        message: '{VALUE} is not a valid document status'
      },
      default: 'queued',
      index: true
    },
    errorMessage: {
      type: String,
      default: null
    },
    pageCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes as required by Section 8 (Page 10)
documentSchema.index({ orgId: 1, createdAt: -1 });
documentSchema.index({ orgId: 1, status: 1 });
documentSchema.index({ orgId: 1, docType: 1 });
documentSchema.index({ orgId: 1, folderId: 1 });

module.exports = mongoose.model('Document', documentSchema);
