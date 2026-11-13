const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Document, Extraction } = require('../src/models');
const { processDocument } = require('../src/queues/processor');

async function testReprocess() {
  await mongoose.connect(process.env.MONGO_URI);
  const doc = await Document.findOne({ originalName: /sterling/i });
  if (!doc) {
    console.log('Doc not found');
    process.exit(1);
  }

  console.log(`Reprocessing doc "${doc.originalName}" (resetting templateId to null for auto-detect)...`);
  doc.templateId = null;
  doc.docType = 'Other';
  doc.status = 'queued';
  await doc.save();

  await processDocument(doc._id);

  const updatedDoc = await Document.findById(doc._id);
  const ext = await Extraction.findOne({ documentId: doc._id });

  console.log('\n=== REPROCESS RESULTS ===');
  console.log('Document Type:', updatedDoc.docType);
  console.log('Status:', updatedDoc.status);
  console.log('Classification Confidence:', updatedDoc.classificationConfidence);
  console.log('Extraction Fields:');
  ext.fields.forEach((f) => {
    console.log(`  - ${f.key}: ${JSON.stringify(f.value)} (conf: ${f.confidence}, page: ${f.sourcePage})`);
  });

  await mongoose.disconnect();
}

testReprocess()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

