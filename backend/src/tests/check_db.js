import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

async function checkDatabase() {
  console.log('--- Checking MongoDB Setup ---');
  const uri = process.argv[2] || process.env.MONGO_URI || 'mongodb://localhost:27017/asset_ops_dashboard';
  console.log('Target URI:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials if any

  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ MongoDB connection: OK');
    console.log('Host:', conn.connection.host);
    console.log('Port:', conn.connection.port);
    console.log('Database Name:', conn.connection.name);

    const db = conn.connection.db;
    const collections = await db.listCollections().toArray();
    console.log(`\nCollections Found (${collections.length}):`);

    if (collections.length === 0) {
      console.log('ℹ️ No collections found yet. Database is empty or newly created.');
    } else {
      for (const col of collections) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`  • ${col.name.padEnd(20)} : ${count} documents`);
      }
    }

    await mongoose.connection.close();
    console.log('\nStatus: MongoDB setup is completely healthy and operational.');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();
