const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { exportToExcel } = require('../controllers/exportController');

// All export routes require authentication
router.use(authenticate);

// POST /api/export/excel - Export documents to Excel
// Admin, Employee, and Reviewer are permitted; Viewer (read-only) is blocked
router.post('/excel', allow('admin', 'reviewer', 'employee'), exportToExcel);

module.exports = router;

