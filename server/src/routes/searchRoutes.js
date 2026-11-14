const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { searchDocuments } = require('../controllers/searchController');

// All search routes require authentication & orgId tenant isolation
router.use(authenticate);

// GET /api/search - Hybrid semantic + keyword document search
router.get('/', searchDocuments);

module.exports = router;
