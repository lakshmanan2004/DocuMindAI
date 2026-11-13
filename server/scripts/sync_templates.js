const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Template } = require('../src/models');
const { builtInTemplates } = require('../src/seed/templates');

async function syncTemplates() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas');

  for (const builtIn of builtInTemplates) {
    const res = await Template.updateMany(
      { name: builtIn.name },
      {
        $set: {
          keywords: builtIn.keywords,
          description: builtIn.description,
          fields: builtIn.fields,
          rules: builtIn.rules
        }
      }
    );
    console.log(`Updated "${builtIn.name}": matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }

  await mongoose.disconnect();
  console.log('Done syncing templates.');
}

syncTemplates()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

