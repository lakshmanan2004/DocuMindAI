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
      default: null
    },
    status: {
      type: String,
      enum: {
        values: ['uploaded', 'queued', 'processing', 'completed', 'needs_review', 'failed', 'reviewed'],
        message: '{VALUE} is not a valid document status'
      },
      default: 'uploaded',
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

// Compound index: Fast sorting and filtering within a tenant
documentSchema.index({ orgId: 1, createdAt: -1 });
documentSchema.index({ orgId: 1, status: 1 });

module.exports = mongoose.model('Document', documentSchema);

