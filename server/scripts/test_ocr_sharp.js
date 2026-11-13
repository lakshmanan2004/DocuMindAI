const sharp = require('sharp');
const { createWorker } = require('tesseract.js');
const path = require('path');

async function testOCR() {
  const imgPath = 'c:/Users/AD-LAB/Projects/DocuMindAI/server/uploads/doc-1794565861543-5fd9305371626107.png';
  
  // Try 1: grayscale + normalize + sharpen
  const buf = await sharp(imgPath)
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.5 })
    .toBuffer();

  const worker = await createWorker('eng', 1, { cachePath: path.resolve(__dirname, '../') });
  const { data } = await worker.recognize(buf);
  console.log('=== OCR WITH NORMALIZE & SHARPEN ===');
  console.log(data.text);
  await worker.terminate();
}

testOCR().catch(console.error);

