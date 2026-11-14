const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Document, Extraction } = require('../src/models');
const { processDocument } = require('../src/queues/processor');

async function reprocessUserDocs() {
  await mongoose.connect(process.env.MONGO_URI);

  const docs = await Document.find({
    originalName: { $in: [/cbse/i, /whatsapp/i, /image/i, /screenshot/i] }
  });

  console.log(`Found ${docs.length} mark sheet docs to reprocess:`);
  docs.forEach(d => console.log(` - ${d.originalName} (${d._id})`));

  for (const doc of docs) {
    console.log(`\nReprocessing: ${doc.originalName} (${doc._id})...`);
    doc.status = 'queued';
    await doc.save();

    await processDocument(doc._id);

    const ext = await Extraction.findOne({ documentId: doc._id });
    console.log(`Updated Extraction for ${doc.originalName}:`);
    ext.fields.forEach(f => {
      if (f.type === 'table') {
        console.log(`  ${f.key} (table with ${f.value ? f.value.length : 0} rows)`);
        if (f.value && f.value.length > 0) {
          f.value.slice(0, 5).forEach((r, idx) => console.log(`     ${idx+1}.`, JSON.stringify(r)));
        }
      } else {
        console.log(`  ${f.key}: ${JSON.stringify(f.value)} (conf: ${f.confidence})`);
      }
    });
  }

  await mongoose.disconnect();
}

reprocessUserDocs()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
