const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Resolve upload directory from environment variable or default to 'uploads'
const uploadDirectory = path.resolve(
  __dirname,
  '..',
  '..',
  process.env.UPLOAD_DIR || 'uploads'
);

// Ensure upload directory exists
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Allowed MIME types and extensions
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg'
];

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    // Generate a unique random filename to prevent collisions and directory traversal
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

// File filter to restrict uploads to allowed document types
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeTypeAllowed = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const extAllowed = ALLOWED_EXTENSIONS.includes(ext);

  if (mimeTypeAllowed && extAllowed) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file format '${ext}'. Only PDF, PNG, and JPG/JPEG files are allowed.`
      ),
      false
    );
  }
};

const maxFileSizeMB = parseInt(process.env.MAX_FILE_MB, 10) || 15;

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSizeMB * 1024 * 1024 // in bytes
  }
});

module.exports = {
  upload,
  uploadDirectory
};

