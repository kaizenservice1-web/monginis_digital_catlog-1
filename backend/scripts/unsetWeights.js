const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const Cake = require('../models/Cake');

const MONGODB_URI = process.env.MONGODB_URI;

const hasRealMongoUri = Boolean(MONGODB_URI) && !String(MONGODB_URI).includes('<');

(async () => {
  if (!hasRealMongoUri) {
    console.error('MongoDB not configured. Set a real MONGODB_URI in backend/.env');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    const result = await Cake.collection.updateMany({}, { $unset: { weights: '' } });

    console.log('Unset weights field on cakes');
    console.log(JSON.stringify({ matched: result.matchedCount, modified: result.modifiedCount }));

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
})();
