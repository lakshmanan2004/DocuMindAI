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
  deleteDocument,
  bulkDeleteDocuments,
  getDocumentSummary,
  createDocumentSummary
} = require('../controllers/documentController');
const authenticate = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { upload } = require('../middleware/upload');

// Multer error handling wrapper supporting both 'files' (multi) and 'file' (single)
const handleUpload = (req, res, next) => {
  const uploadFields = upload.fields([
    { name: 'files', maxCount: 15 },
    { name: 'file', maxCount: 1 }
  ]);

  uploadFields(req, res, (err) => {
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

    // Normalize req.files: combine array of files from either 'files' or 'file'
    const filesArray = [];
    if (req.files) {
      if (req.files.files) filesArray.push(...req.files.files);
      if (req.files.file) filesArray.push(...req.files.file);
    }
    req.files = filesArray;
    if (filesArray.length === 1) req.file = filesArray[0];

    next();
  });
};

// All document routes require authentication
router.use(authenticate);

// Document CRUD & Upload (Spec M2)
router.post(
  '/',
  allow('admin', 'employee', 'reviewer'),
  handleUpload,
  uploadDocument
);
router.post('/bulk-delete', allow('admin', 'employee'), bulkDeleteDocuments);
router.get('/', getDocuments);
router.get('/:id', getDocumentById);
router.get('/:id/file', getDocumentFile);
router.delete('/:id', deleteDocument);

// Pages & Reprocessing
router.get('/:id/pages', getDocumentPages);
router.post('/:id/reprocess', allow('admin', 'reviewer'), reprocessDocument);

// Extraction & Review (M5)
router.get('/:id/extraction', getDocumentExtraction);
router.put('/:id/extraction', allow('admin', 'reviewer'), saveExtractionCorrections);
router.post('/:id/approve', allow('admin', 'reviewer'), approveDocument);

// AI Summaries (M7)
router.get('/:id/summary', getDocumentSummary);
router.post('/:id/summary', allow('admin', 'reviewer', 'employee'), createDocumentSummary);

module.exports = router;
