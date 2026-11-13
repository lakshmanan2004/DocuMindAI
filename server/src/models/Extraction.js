const mongoose = require('mongoose');

const extractedFieldSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true
  },
  label: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'string'
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  confidence: {
    type: Number,
    default: 0
  },
  sourcePage: {
    type: Number,
    default: 1
  },
  sourceText: {
    type: String,
    default: ''
  },
  edited: {
    type: Boolean,
    default: false
  }
});

const extractionSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
      required: true,
      index: true
    },
    fields: [extractedFieldSchema],
    validationIssues: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

extractionSchema.index({ orgId: 1, documentId: 1 }, { unique: true });

module.exports = mongoose.model('Extraction', extractionSchema);
