import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { seedDatabase } from '../services/seedService.js';

async function runSeed() {
  console.log('--- Seeding MongoDB Database ---');
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/asset_ops_dashboard';
  console.log('Connecting to:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB. Generating assets, personas, and telemetry...');
    const result = await seedDatabase();
    console.log('✅ Seeding Complete!');
    console.log(`  • Users Created    : ${result.usersCreated}`);
    console.log(`  • Assets Created   : ${result.assetsCreated}`);
    console.log(`  • Readings Created : ${result.readingsCreated}`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
}

runSeed();
