const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log('Atlas Connected successfully!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Atlas Connect Error:', e.message);
    process.exit(1);
  });

