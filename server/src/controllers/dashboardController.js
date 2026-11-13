const mongoose = require('mongoose');
const { Document, User, Extraction } = require('../models');

/**
 * Get aggregated organization dashboard statistics
 * GET /api/dashboard/stats
 */
const getDashboardStats = async (req, res) => {
  try {
    const orgId = new mongoose.Types.ObjectId(req.user.orgId);

    // Document counts grouped by status
    const counts = await Document.aggregate([
      { $match: { orgId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const statusCounts = {
      total: 0,
      uploaded: 0,
      queued: 0,
      processing: 0,
      completed: 0,
      needs_review: 0,
      reviewed: 0,
      failed: 0
    };

    counts.forEach((c) => {
      if (statusCounts[c._id] !== undefined) {
        statusCounts[c._id] = c.count;
      }
      statusCounts.total += c.count;
    });

    // Total team members in organization
    const totalUsers = await User.countDocuments({ orgId });

    // Recent 5 documents
    const recentDocuments = await Document.find({ orgId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('uploadedBy', 'name email role');

    res.status(200).json({
      statusCounts,
      totalUsers,
      recentDocuments
    });
  } catch (error) {
    console.error('[Dashboard Stats Error]', error);
    res.status(500).json({ message: 'Failed to retrieve dashboard statistics' });
  }
};

module.exports = {
  getDashboardStats
};

