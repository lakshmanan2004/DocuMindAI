const { AuditLog } = require('../models');

/**
 * Record an audit log entry for sensitive tenant actions (Spec Section 8 & M8)
 * auditlogs: orgId, userId, action, targetType, targetId, meta, createdAt
 */
async function recordAudit({
  orgId,
  userId,
  userName = '',
  userRole = '',
  action,
  targetType = '',
  targetId = '',
  meta = {},
  details = null
}) {
  try {
    if (!orgId || !userId || !action) {
      return;
    }

    await AuditLog.create({
      orgId,
      userId,
      userName,
      userRole,
      action,
      targetType,
      targetId,
      meta: details || meta || {}
    });
  } catch (err) {
    // Non-blocking: Audit logging errors should never crash primary user requests
    console.error('[Audit Service Error] Failed to record audit log:', err.message);
  }
}

module.exports = {
  recordAudit
};
