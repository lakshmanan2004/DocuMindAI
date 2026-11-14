const { Document } = require('../models');
const { answerWithRAG } = require('../services/rag');

/**
 * Handle user chat question with RAG over organization documents
 * POST /api/chat
 */
const askChat = async (req, res) => {
  try {
    const { question, documentId, folderId } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ message: 'A valid question is required' });
    }

    const orgId = req.user.orgId;

    const result = await answerWithRAG({
      question: question.trim(),
      orgId,
      documentId: documentId || null,
      folderId: folderId || null
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('[Chat Controller Error]', error);
    res.status(500).json({ message: error.message || 'Error processing chat query' });
  }
};

/**
 * Get available documents for filtering in the Chat UI
 * GET /api/chat/documents
 */
const getChatDocuments = async (req, res) => {
  try {
    const documents = await Document.find({
      orgId: req.user.orgId,
      status: { $in: ['completed', 'needs_review', 'reviewed'] }
    })
      .select('_id originalName status pageCount createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json(documents);
  } catch (error) {
    console.error('[Chat Documents Error]', error);
    res.status(500).json({ message: 'Error retrieving documents for chat' });
  }
};

module.exports = {
  askChat,
  getChatDocuments
};
