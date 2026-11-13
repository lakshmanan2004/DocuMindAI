const mongoose = require('mongoose');

const templateFieldSchema = new mongoose.Schema({
  key: {
    type: String,
    required: [true, 'Field key is required'],
    trim: true
  },
  label: {
    type: String,
    required: [true, 'Field label is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['string', 'number', 'date'],
    default: 'string'
  },
  required: {
    type: Boolean,
    default: false
  },
  hint: {
    type: String,
    trim: true,
    default: ''
  }
});

const templateSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true
    },
    fields: [templateFieldSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

templateSchema.index({ orgId: 1, name: 1 });

module.exports = mongoose.model('Template', templateSchema);

