const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { getDashboardStats } = require('../controllers/dashboardController');

router.use(authenticate);

// GET /api/dashboard/stats - Organization overview statistics
router.get('/stats', getDashboardStats);

module.exports = router;

