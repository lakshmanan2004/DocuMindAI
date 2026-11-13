const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Organization, Template } = require('../src/models');
const { builtInTemplates } = require('../src/seed/templates');

async function cleanSaveetha() {
  await mongoose.connect(process.env.MONGO_URI);
  const saveetha = await Organization.findOne({ name: /Saveetha/i });
  if (saveetha) {
    const inv = builtInTemplates.find((t) => t.name === 'Invoice');
    await Template.updateOne(
      { orgId: saveetha._id, name: 'Invoice' },
      {
        $set: {
          fields: inv.fields,
          rules: inv.rules,
          description: inv.description,
          keywords: inv.keywords
        }
      }
    );
    await Template.deleteOne({ orgId: saveetha._id, name: 'Agreement' });

    const list = await Template.find({ orgId: saveetha._id });
    console.log('Saveetha final templates:');
    list.forEach((t) => console.log(` * ${t.name} (${t.fields.length} fields, ${t.rules.length} rules)`));
  }
  await mongoose.disconnect();
}

cleanSaveetha()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
