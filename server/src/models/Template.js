const mongoose = require('mongoose');

const templateColumnSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['string', 'number', 'date', 'boolean'],
      default: 'string'
    }
  },
  { _id: false }
);

const templateFieldSchema = new mongoose.Schema(
  {
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
      enum: ['string', 'number', 'date', 'boolean', 'list', 'table'],
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
    },
    columns: [templateColumnSchema]
  },
  { _id: false }
);

const templateRuleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'required',
        'regex',
        'number_range',
        'date_order',
        'table_sum_equals',
        'sum_of_fields_equals',
        'unique_in_org'
      ],
      required: true
    },
    field: { type: String },
    pattern: { type: String },
    min: { type: Number },
    max: { type: Number },
    before: { type: String },
    after: { type: String },
    table: { type: String },
    column: { type: String },
    target: { type: String },
    tolerance: { type: Number, default: 0 },
    fields: [{ type: String }],
    message: { type: String, required: true },
    severity: {
      type: String,
      enum: ['error', 'warning'],
      default: 'warning'
    }
  },
  { _id: false }
);

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
    description: {
      type: String,
      trim: true,
      default: ''
    },
    keywords: [{ type: String }],
    fields: [templateFieldSchema],
    rules: [templateRuleSchema],
    isBuiltIn: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

templateSchema.index({ orgId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Template', templateSchema);
