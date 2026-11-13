const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const { fallbackExtract, postProcessExtracted } = require('./src/services/llm');
const { scoreConfidence } = require('./src/services/confidence');
const { validateExtraction } = require('./src/services/validate');

const dummyTemplate = {
  name: 'Invoice',
  fields: [
    { key: 'invoice_number', label: 'Invoice Number', type: 'string' },
    { key: 'gstin', label: 'GSTIN', type: 'string' },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'total_amount', label: 'Total Amount', type: 'number' }
  ]
};

async function diagnose() {
  const uploadsDir = path.join(__dirname, 'uploads');
  const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.pdf'));
  
  let worker = null;

  for (const fileName of files) {
    console.log(`\n========================================`);
    console.log(`FILE: ${fileName}`);
    const filePath = path.join(uploadsDir, fileName);
    const dataBuffer = fs.readFileSync(filePath);

    try {
      const parser = new PDFParse({ data: dataBuffer });
      const textResult = await parser.getText();
      let fullText = textResult.text || '';
      console.log(`Digital text length: ${fullText.trim().length}`);

      if (fullText.trim().length < 30) {
        console.log('Scanned/Raster PDF. Running OCR...');
        if (!worker) {
          worker = await createWorker('eng', 1, { cachePath: __dirname });
        }
        const screenshots = await parser.getScreenshot({ imageBuffer: true, scale: 2.0 });
        const ocrRes = await worker.recognize(Buffer.from(screenshots.pages[0].data));
        fullText = ocrRes.data.text;
        console.log(`OCR text length: ${fullText.length}`);
      }

      console.log('--- SAMPLE EXTRACTED TEXT (First 350 chars) ---');
      console.log(fullText.slice(0, 350).replace(/\n/g, ' '));

      const extracted = fallbackExtract(fullText, dummyTemplate.fields);
      console.log('--- EXTRACTED FIELDS ---');
      console.log(extracted);

      const scored = scoreConfidence(dummyTemplate.fields, extracted, [{ pageNumber: 1, text: fullText, ocrConfidence: 90 }], []);
      for (const f of scored) {
        if (!f.value) {
          console.log(`⚠️ MISSING FIELD: [${f.key}]`);
        }
      }
    } catch (err) {
      console.error(`ERROR PROCESSING ${fileName}:`, err.message);
    }
  }

  if (worker) await worker.terminate();
}

diagnose();

