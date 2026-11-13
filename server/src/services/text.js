const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const { ocrImage } = require('./ocr');

const SERVER_DIR = path.resolve(__dirname, '../../');

/**
 * Sanitize and clean extracted text by stripping isolated margin symbols,
 * OCR table delimiters, and formatting noise
 * @param {string} text - Raw extracted text
 * @returns {string} - Cleaned text
 */
const cleanExtractedText = (text) => {
  if (!text) return '';
  return text
    .split('\n')
    .map((line) => {
      // 1. Strip isolated leading/trailing punctuation artifacts
      let l = line.replace(/^[\s=\-_|:!.,~*+•[\]{}()]+\s*/g, '').replace(/\s*[\s=\-_|:!.,~*+•[\]{}()]+$/g, '').trim();
      // 2. Clean table column brackets around numbers: e.g. "[31,270.34]" -> "31,270.34"
      l = l.replace(/\[\s*([\d,.]+)\s*\]/g, '$1');
      // 3. Normalize table column pipe borders
      l = l.replace(/\s*\|\s*/g, ' | ');
      return l.trim();
    })
    .filter((line) => {
      // Drop empty lines or lines that consist solely of punctuation symbols or noise
      return line.length > 0 && !/^[\s=\-_|:!.,~*+•[\]{}()]+$/.test(line);
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Extract text from a document (PDF or Image) page by page (Spec Section 5 & M3)
 * If a PDF page has fewer than 30 characters, rasterizes and runs Tesseract OCR.
 * @param {string} filePath - Path to the document
 * @param {string} mimeType - MIME type of the document
 * @returns {Promise<Array<{ pageNumber: number, text: string, ocrConfidence: number }>>}
 */
const extractDocumentText = async (filePath, mimeType) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist at path: ${filePath}`);
  }

  // 1. Direct Image OCR (PNG, JPG, JPEG)
  if (mimeType.startsWith('image/')) {
    const ocrResult = await ocrImage(filePath);
    const cleaned = cleanExtractedText(ocrResult.text);

    return [
      {
        pageNumber: 1,
        text: cleaned,
        ocrConfidence: ocrResult.confidence || 0
      }
    ];
  }

  // 2. PDF Processing
  if (mimeType === 'application/pdf') {
    const dataBuffer = fs.readFileSync(filePath);

    try {
      const parser = new PDFParse({ data: dataBuffer });
      const textResult = await parser.getText();

      const pages = [];
      let worker = null;

      const rawPages = textResult.pages || [];
      let screenshots = null;

      for (let i = 0; i < rawPages.length; i++) {
        const p = rawPages[i];
        let pageText = cleanExtractedText(p.text || '');
        let confidence = 100;

        // If digital text is fewer than 30 characters, attempt rasterization and OCR
        if (pageText.length < 30) {
          try {
            if (!screenshots && parser.getScreenshot) {
              screenshots = await parser.getScreenshot({ imageBuffer: true, scale: 2.0 }).catch(() => null);
            }

            if (screenshots && screenshots.pages) {
              const pageScreen = screenshots.pages.find((sp) => sp.pageNumber === p.num);
              if (pageScreen && pageScreen.data) {
                if (!worker) {
                  worker = await createWorker('eng', 1, {
                    cachePath: SERVER_DIR,
                    errorHandler: () => {}
                  });
                }
                const ocrRes = await worker.recognize(Buffer.from(pageScreen.data));
                const ocrCleaned = cleanExtractedText(ocrRes.data?.text || '');
                if (ocrCleaned.length > pageText.length) {
                  pageText = ocrCleaned;
                  confidence = Math.round(ocrRes.data?.confidence || 75);
                }
              }
            }
          } catch (ocrErr) {
            console.warn(`[PDF OCR Warning] Page ${p.num} rasterization failed, using digital text:`, ocrErr.message);
          }
        }

        pages.push({
          pageNumber: p.num || (i + 1),
          text: pageText,
          ocrConfidence: confidence
        });
      }

      if (worker) {
        try {
          await worker.terminate();
        } catch (e) {}
      }

      // Fallback if pages array was empty but general text was returned
      if (pages.length === 0 && textResult.text) {
        return [
          {
            pageNumber: 1,
            text: cleanExtractedText(textResult.text),
            ocrConfidence: 100
          }
        ];
      }

      if (pages.length === 0) {
        pages.push({
          pageNumber: 1,
          text: '',
          ocrConfidence: 0
        });
      }

      return pages;
    } catch (pdfErr) {
      throw new Error(`PDF parsing failed: ${pdfErr.message}`);
    }
  }

  // 3. Plain Text format support
  if (mimeType === 'text/plain' || (typeof mimeType === 'string' && mimeType.includes('text'))) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return [
      {
        pageNumber: 1,
        text: cleanExtractedText(raw),
        ocrConfidence: 100
      }
    ];
  }

  throw new Error(`Unsupported document MIME type: ${mimeType}`);
};

module.exports = {
  extractDocumentText,
  cleanExtractedText
};
