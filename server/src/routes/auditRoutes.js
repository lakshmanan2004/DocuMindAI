const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { getAuditLogs } = require('../controllers/auditController');

// All audit routes require authentication
router.use(authenticate);

// GET /api/audit - Only Org Admin can view audit logs
router.get('/', allow('admin'), getAuditLogs);

module.exports = router;

