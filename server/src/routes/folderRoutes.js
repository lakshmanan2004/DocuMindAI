const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { allow } = require('../middleware/role');
const {
  getFolders,
  createFolder,
  renameFolder,
  deleteFolder
} = require('../controllers/folderController');

// All folder routes require authentication
router.use(authenticate);

// Any authenticated role can list folders
router.get('/', getFolders);

// Admin-only operations (Spec Section 6 M2 & Page 11 API reference)
router.post('/', allow('admin'), createFolder);
router.patch('/:id', allow('admin'), renameFolder);
router.delete('/:id', allow('admin'), deleteFolder);

module.exports = router;
