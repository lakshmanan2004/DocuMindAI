const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Document, DocumentPage } = require('../src/models');

async function inspectSterlingPages() {
  await mongoose.connect(process.env.MONGO_URI);
  const doc = await Document.findOne({ originalName: /sterling/i });
  const p1 = await DocumentPage.findOne({ documentId: doc._id, pageNumber: 1 });
  console.log('=== PAGE 1 LINES ===');
  p1.text.split('\n').forEach((line, i) => console.log(`${i}: "${line}"`));

  const p3 = await DocumentPage.findOne({ documentId: doc._id, pageNumber: 3 });
  console.log('=== PAGE 3 LINES ===');
  p3.text.split('\n').forEach((line, i) => console.log(`${i}: "${line}"`));

  await mongoose.disconnect();
}

inspectSterlingPages().catch(console.error);

