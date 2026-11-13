const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Document, DocumentPage } = require('../src/models');

async function checkTexts() {
  await mongoose.connect(process.env.MONGO_URI);
  const docs = await Document.find({
    originalName: { $in: [/sterling/i, /cbc/i, /screenshot/i] }
  });

  for (const doc of docs) {
    console.log(`\n========================================`);
    console.log(`DOC: ${doc.originalName} (${doc._id})`);
    const pages = await DocumentPage.find({ documentId: doc._id }).sort({ pageNumber: 1 });
    pages.forEach(p => {
      console.log(`--- Page ${p.pageNumber} (length: ${p.text.length}) ---`);
      console.log(p.text.slice(0, 800));
    });
  }
  await mongoose.disconnect();
}

checkTexts().catch(console.error);

