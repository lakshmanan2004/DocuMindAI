const { createWorker } = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const SERVER_DIR = path.resolve(__dirname, '../../');

/**
 * Preprocess image cleanly for OCR
 * @param {string} inputPath - Path to original image file
 * @returns {Promise<Buffer>} - Cleaned image buffer
 */
const preprocessImage = async (inputPath) => {
  try {
    const meta = await sharp(inputPath).metadata();

    let pipeline = sharp(inputPath);

    // If image is low-resolution (< 1800px), upscale 2x with lanczos3 for crisp OCR character definition
    if (meta.width && meta.width < 1800) {
      pipeline = pipeline.resize({ width: Math.min(2600, Math.round(meta.width * 2)), kernel: 'lanczos3' });
    } else if (meta.width && meta.width > 2800) {
      pipeline = pipeline.resize({ width: 2800, withoutEnlargement: true });
    }

    const processedBuffer = await pipeline
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.2 })
      .toBuffer();
    return processedBuffer;
  } catch (error) {
    console.warn('[OCR Preprocess Warning] Falling back to raw file:', error.message);
    return fs.readFileSync(inputPath);
  }
};

/**
 * Perform OCR on an image file safely using Tesseract.js
 * Rule 4: Never crash the worker
 * @param {string} imagePath - Absolute path to image on disk
 * @returns {Promise<{ text: string, confidence: number }>}
 */
const ocrImage = async (imagePath) => {
  let worker = null;
  try {
    const imageBuffer = await preprocessImage(imagePath);

    worker = await createWorker('eng', 1, {
      cachePath: SERVER_DIR,
      errorHandler: (err) => console.warn('[Tesseract Worker Warning]', err?.message || err)
    });

    const { data } = await worker.recognize(imageBuffer);

    return {
      text: (data.text || '').trim(),
      confidence: Math.round(data.confidence || 0)
    };
  } catch (error) {
    console.warn('[OCR Error Caught Safely]', error.message);
    return {
      text: '',
      confidence: 0
    };
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {}
    }
  }
};

module.exports = {
  ocrImage,
  preprocessImage
};
