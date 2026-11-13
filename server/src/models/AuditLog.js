const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    targetType: {
      type: String,
      trim: true,
      default: ''
    },
    targetId: {
      type: String,
      trim: true,
      default: ''
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    // Helpful denormalized fields for fast dashboard reporting
    userName: {
      type: String,
      default: ''
    },
    userRole: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for org filtering and date ranges
auditLogSchema.index({ orgId: 1, createdAt: -1 });
auditLogSchema.index({ orgId: 1, action: 1 });
auditLogSchema.index({ orgId: 1, userId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
