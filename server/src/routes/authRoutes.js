const express = require('express');
const router = express.Router();
const { registerOrg, login, getMe } = require('../controllers/authController');
const authenticate = require('../middleware/auth');

router.post('/register-org', registerOrg);
router.post('/login', login);
router.get('/me', authenticate, getMe);

module.exports = router;

