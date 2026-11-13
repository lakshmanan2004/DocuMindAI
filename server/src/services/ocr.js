const { createWorker } = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');

const path = require('path');
const SERVER_DIR = path.resolve(__dirname, '../../');

/**
 * Preprocess image cleanly for OCR without distorting screen photos or pixel grids
 * @param {string} inputPath - Path to original image file
 * @returns {Promise<Buffer>} - Cleaned image buffer
 */
const preprocessImage = async (inputPath) => {
  try {
    const meta = await sharp(inputPath).metadata();

    let pipeline = sharp(inputPath);

    // Limit oversized images to 2500px width for fast and reliable OCR
    if (meta.width && meta.width > 2500) {
      pipeline = pipeline.resize({ width: 2500, withoutEnlargement: true });
    }

    // Convert to grayscale to neutralize colored background hues without creating high-frequency noise
    const processedBuffer = await pipeline.grayscale().toBuffer();
    return processedBuffer;
  } catch (error) {
    console.warn('[OCR Preprocess Warning] Falling back to raw file:', error.message);
    return fs.readFileSync(inputPath);
  }
};

/**
 * Perform OCR on an image file using Tesseract.js
 * @param {string} imagePath - Absolute path to image on disk
 * @returns {Promise<{ text: string, confidence: number }>}
 */
const ocrImage = async (imagePath) => {
  let worker = null;
  try {
    const imageBuffer = await preprocessImage(imagePath);

    worker = await createWorker('eng', 1, { cachePath: SERVER_DIR });
    const { data } = await worker.recognize(imageBuffer);

    return {
      text: (data.text || '').trim(),
      confidence: Math.round(data.confidence || 0)
    };
  } catch (error) {
    console.error('[OCR Error]', error);
    throw error;
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
};

module.exports = {
  ocrImage,
  preprocessImage
};
