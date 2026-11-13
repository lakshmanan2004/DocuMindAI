const express = require('express');
const router = express.Router();
const {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  testTemplate
} = require('../controllers/templateController');
const authenticate = require('../middleware/auth');
const { allow } = require('../middleware/role');

// All routes require authentication
router.use(authenticate);

// Public to all members of the organization
router.get('/', getTemplates);
router.post('/test', testTemplate);
router.get('/:id', getTemplateById);

// Admin-only management
router.post('/', allow('admin'), createTemplate);
router.post('/:id/duplicate', allow('admin'), duplicateTemplate);
router.put('/:id', allow('admin'), updateTemplate);
router.delete('/:id', allow('admin'), deleteTemplate);

module.exports = router;
