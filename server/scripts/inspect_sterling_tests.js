const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Document, Extraction } = require('../src/models');

async function inspectSterlingTests() {
  await mongoose.connect(process.env.MONGO_URI);
  const doc = await Document.findOne({ originalName: /sterling/i });
  const ext = await Extraction.findOne({ documentId: doc._id });
  const testsField = ext.fields.find(f => f.key === 'tests');
  console.log(`Sterling has ${testsField.value.length} tests:`);
  testsField.value.forEach((t, i) => {
    console.log(`${i + 1}. [${t.test_name}] val: "${t.value}" unit: "${t.unit}" ref: "${t.reference_range}" flag: "${t.flag}"`);
  });
  await mongoose.disconnect();
}

inspectSterlingTests().catch(console.error);

