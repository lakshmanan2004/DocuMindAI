const { AuditLog } = require('../models');

/**
 * Get organization audit logs (Admin only)
 * GET /api/audit
 */
const getAuditLogs = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const { action, limit = 50, skip = 0 } = req.query;

    const filter = { orgId };
    if (action) {
      filter.action = action;
    }

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit));

    const total = await AuditLog.countDocuments(filter);

    res.status(200).json({
      logs,
      total,
      limit: Number(limit),
      skip: Number(skip)
    });
  } catch (error) {
    console.error('[Audit Controller Error]', error);
    res.status(500).json({ message: 'Failed to retrieve audit logs' });
  }
};

module.exports = {
  getAuditLogs
};

