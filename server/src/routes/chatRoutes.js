const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { askChat, getChatDocuments } = require('../controllers/chatController');

// All chat routes require authentication & orgId isolation
router.use(authenticate);

// POST /api/chat - Ask question with RAG citations
router.post('/', askChat);

// GET /api/chat/documents - List documents available for chat filtering
router.get('/documents', getChatDocuments);

module.exports = router;

