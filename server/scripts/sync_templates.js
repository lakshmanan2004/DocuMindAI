const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
const { Template } = require('../src/models');
const { builtInTemplates } = require('../src/seed/templates');

async function syncMarkSheetTemplates() {
  await mongoose.connect(process.env.MONGO_URI);
  const markMaster = builtInTemplates.find(t => t.name === 'Mark Sheet');

  const templates = await Template.find({ name: 'Mark Sheet' });
  console.log(`Found ${templates.length} Mark Sheet templates across organizations to update.`);

  for (const t of templates) {
    t.fields = markMaster.fields;
    t.rules = markMaster.rules;
    await t.save();
    console.log(`Updated Mark Sheet template for org: ${t.orgId}`);
  }

  await mongoose.disconnect();
}

syncMarkSheetTemplates().catch(console.error);
