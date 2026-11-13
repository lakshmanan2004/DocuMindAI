const sharp = require('sharp');
const { createWorker } = require('tesseract.js');
const path = require('path');

async function testUpscaleOCR() {
  const imgPath = 'c:/Users/AD-LAB/Projects/DocuMindAI/server/uploads/doc-1794565861543-5fd9305371626107.png';
  
  // Upscale 2x for low-res screenshots (< 1500px)
  const buf = await sharp(imgPath)
    .resize({ width: 2358, kernel: 'lanczos3' })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.2 })
    .toBuffer();

  const worker = await createWorker('eng', 1, { cachePath: path.resolve(__dirname, '../') });
  const { data } = await worker.recognize(buf);
  console.log('=== OCR WITH 2X UPSCALE & LANCZOS3 ===');
  console.log(data.text);
  await worker.terminate();
}

testUpscaleOCR().catch(console.error);

