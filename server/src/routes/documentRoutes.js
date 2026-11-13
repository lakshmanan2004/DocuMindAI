const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  uploadDocument,
  getDocuments,
  getDocumentById,
  getDocumentPages,
  getDocumentExtraction,
  saveExtractionCorrections,
  approveDocument,
  reprocessDocument,
  getDocumentFile,
  deleteDocument
} = require('../controllers/documentController');
const authenticate = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { upload } = require('../middleware/upload');

// Multer error handling wrapper
const handleUpload = (req, res, next) => {
  const uploadSingle = upload.single('file');
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxMB = process.env.MAX_FILE_MB || 15;
        return res.status(400).json({
          message: `File too large. Maximum allowed size is ${maxMB} MB.`
        });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// All document routes require authentication
router.use(authenticate);

// Document CRUD & Upload
router.post(
  '/',
  allow('admin', 'employee', 'reviewer'),
  handleUpload,
  uploadDocument
);
router.get('/', getDocuments);
router.get('/:id', getDocumentById);
router.get('/:id/file', getDocumentFile);
router.delete('/:id', deleteDocument);

// Pages & Reprocessing
router.get('/:id/pages', getDocumentPages);
router.post('/:id/reprocess', allow('admin', 'reviewer'), reprocessDocument);

// Extraction & Review (Phase 3)
router.get('/:id/extraction', getDocumentExtraction);
router.put('/:id/extraction', allow('admin', 'reviewer'), saveExtractionCorrections);
router.post('/:id/approve', allow('admin', 'reviewer'), approveDocument);

module.exports = router;
