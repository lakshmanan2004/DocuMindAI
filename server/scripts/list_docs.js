const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Document, Organization } = require('../src/models');

async function checkDocs() {
  await mongoose.connect(process.env.MONGO_URI);
  const saveetha = await Organization.findOne({ name: /Saveetha/i });
  const docs = await Document.find({ orgId: saveetha._id }).sort({ createdAt: -1 });
  console.log(`Saveetha has ${docs.length} documents:`);
  docs.forEach(d => {
    console.log(`ID: ${d._id} | Name: ${d.originalName} | Type: ${d.docType} | File: ${d.filePath} | Size: ${d.size}`);
  });
  await mongoose.disconnect();
}

checkDocs().catch(console.error);
