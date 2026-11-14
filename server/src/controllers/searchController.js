const { hybridSearch } = require('../services/rag');

/**
 * GET /api/search
 * Query parameters:
 *   - q: Search query (required)
 *   - documentId: Optional document scope
 *   - folderId: Optional folder scope
 *   - limit: Number of results (default 10)
 */
const searchDocuments = async (req, res) => {
  try {
    const { q, documentId, folderId, limit } = req.query;

    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.status(400).json({ message: 'Search query parameter (q) is required' });
    }

    const orgId = req.user.orgId;
    const numLimit = parseInt(limit, 10) || 10;

    const results = await hybridSearch({
      query: q.trim(),
      orgId,
      documentId: documentId || null,
      folderId: folderId || null,
      limit: Math.min(Math.max(numLimit, 1), 50)
    });

    res.status(200).json({
      query: q.trim(),
      total: results.length,
      results
    });
  } catch (error) {
    console.error('[Search Controller Error]', error);
    res.status(500).json({ message: error.message || 'Error executing hybrid search' });
  }
};

module.exports = {
  searchDocuments
};
