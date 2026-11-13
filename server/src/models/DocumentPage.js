const mongoose = require('mongoose');

const documentPageSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'Document ID is required'],
      index: true
    },
    pageNumber: {
      type: Number,
      required: [true, 'Page number is required']
    },
    text: {
      type: String,
      default: ''
    },
    ocrConfidence: {
      type: Number,
      default: 100 // 100 for native digital text, Tesseract score for OCR
    }
  },
  {
    timestamps: true
  }
);

// Compound index for querying pages of a specific document in an organization
documentPageSchema.index({ orgId: 1, documentId: 1, pageNumber: 1 });

module.exports = mongoose.model('DocumentPage', documentPageSchema);

