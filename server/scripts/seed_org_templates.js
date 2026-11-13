const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Organization, Template, User } = require('../src/models');
const { builtInTemplates } = require('../src/seed/templates');

async function seedMissing() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas');

  const orgs = await Organization.find();
  console.log('Total organizations:', orgs.length);

  for (const org of orgs) {
    const adminUser = await User.findOne({ orgId: org._id, role: 'admin' });
    const userId = adminUser ? adminUser._id : null;

    for (const tmpl of builtInTemplates) {
      const exists = await Template.findOne({
        orgId: org._id,
        name: tmpl.name
      });

      if (!exists) {
        console.log(`Seeding "${tmpl.name}" for "${org.name}"`);
        await Template.create({
          ...tmpl,
          orgId: org._id,
          createdBy: userId
        });
      }
    }
  }

  const saveetha = await Organization.findOne({ name: /Saveetha/i });
  if (saveetha) {
    const list = await Template.find({ orgId: saveetha._id });
    console.log('\nSaveetha templates now:');
    list.forEach((t) => console.log(` - ${t.name} (${t.fields.length} fields)`));
  }

  await mongoose.disconnect();
}

seedMissing()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
