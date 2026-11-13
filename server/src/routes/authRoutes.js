const express = require('express');
const router = express.Router();
const {
  registerOrg,
  login,
  getMe,
  updateMe,
  changePassword
} = require('../controllers/authController');
const authenticate = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

// Public routes
router.post('/register-org', registerOrg);
router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }), login);

// Authenticated session and profile routes (Spec M1 & API Ref)
router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, updateMe);
router.patch('/me/password', authenticate, changePassword);

module.exports = router;
