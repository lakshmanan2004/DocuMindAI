const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Document, DocumentPage } = require('../src/models');
const { extractWithLlama } = require('../src/services/llm');
const { builtInTemplates } = require('../src/seed/templates');

async function debugScreenshot() {
  await mongoose.connect(process.env.MONGO_URI);
  const markTmpl = builtInTemplates.find(t => t.name === 'Mark Sheet');
  const markDoc = await Document.findOne({ originalName: /screenshot/i });
  const pages = await DocumentPage.find({ documentId: markDoc._id });
  const fullText = pages.map(p => p.text).join('\n\n');

  console.log('--- Document Text ---');
  console.log(fullText);

  const raw = await extractWithLlama(fullText, markTmpl);
  console.log('\n--- Extracted subjects ---');
  console.log(JSON.stringify(raw.subjects, null, 2));

  await mongoose.disconnect();
}

debugScreenshot().catch(console.error);

