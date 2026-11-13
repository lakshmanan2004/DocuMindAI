const { extractWithLlama } = require('./src/services/llm');

const sampleInvoiceText = `TAX INVOICE
Krishna Mobile Store
Invoice Number: TEST-INV-999
GSTIN: 33AACFK0693D1ZQ
Date: 12-Nov-2026
Total Amount: 1,500.00
Amount in Words: One Thousand Five Hundred only`;

const template = {
  name: 'Invoice',
  fields: [
    { key: 'invoice_number', label: 'Invoice Number', type: 'string' },
    { key: 'gstin', label: 'GSTIN', type: 'string' },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'total_amount', label: 'Total Amount', type: 'number' }
  ]
};

async function test() {
  console.log('=== TESTING LLAMA 3.2 CONNECTION IN DOCUMIND ===');
  const startTime = Date.now();
  const result = await extractWithLlama(sampleInvoiceText, template);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('RESPONSE TIME:', duration + 's');
  console.log('EXTRACTED DATA BY LLAMA:');
  console.log(JSON.stringify(result, null, 2));
}
test();

