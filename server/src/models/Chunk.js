const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema(
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
    chunkIndex: {
      type: Number,
      required: [true, 'Chunk index is required']
    },
    text: {
      type: String,
      required: [true, 'Chunk text content is required']
    },
    embedding: {
      type: [Number],
      required: [true, 'Vector embedding is required']
    }
  },
  {
    timestamps: true
  }
);

// Compound index for organization and document queries
chunkSchema.index({ orgId: 1, documentId: 1, chunkIndex: 1 });

module.exports = mongoose.model('Chunk', chunkSchema);
