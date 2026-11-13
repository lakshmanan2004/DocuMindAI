const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Document, Extraction } = require('../src/models');

async function inspectExtractions() {
  await mongoose.connect(process.env.MONGO_URI);
  const docs = await Document.find({
    originalName: { $in: [/cbc/i, /screenshot/i] }
  }).sort({ createdAt: -1 });

  for (const doc of docs) {
    console.log(`\n========================================`);
    console.log(`DOC: ${doc.originalName} (${doc.docType})`);
    const ext = await Extraction.findOne({ documentId: doc._id });
    if (ext) {
      console.log(`FIELDS:`);
      for (const f of ext.fields) {
        if (f.type === 'table') {
          console.log(`  Table [${f.key}]: ${f.value ? f.value.length : 0} rows`);
          if (Array.isArray(f.value)) {
            f.value.forEach(r => console.log('    ', JSON.stringify(r)));
          }
        } else {
          console.log(`  ${f.key}: ${JSON.stringify(f.value)} (conf: ${f.confidence}, src: ${f.sourcePage})`);
        }
      }
    }
  }

  await mongoose.disconnect();
}

inspectExtractions().catch(console.error);
