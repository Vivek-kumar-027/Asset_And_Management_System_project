import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User, Asset, Alert, MaintenanceLog, Reading } from '../models/index.js';

async function displayCloudData() {
  console.log('====================================================');
  console.log('  MONGODB ATLAS CLOUD DATA INSPECTOR');
  console.log('====================================================');

  const uri = process.env.MONGO_URI;
  console.log('Connected to:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

  try {
    await mongoose.connect(uri);

    // 1. Users
    console.log('\n--- [1] USERS (Collection: users) ---');
    const users = await User.find({}).select('name email role department createdAt').lean();
    console.table(users.map((u) => ({
      ID: u._id.toString().slice(-6),
      Name: u.name,
      Email: u.email,
      Role: u.role,
      Department: u.department || 'All',
    })));

    // 2. Assets
    console.log('\n--- [2] ASSETS (Collection: assets) ---');
    const assets = await Asset.find({}).select('name type department status location maintenanceIntervalDays').lean();
    console.table(assets.map((a) => ({
      ID: a._id.toString().slice(-6),
      Name: a.name,
      Type: a.type,
      Department: a.department,
      Status: a.status,
      Location: `${a.location?.building || ''}, ${a.location?.zone || ''}`,
      Interval: `${a.maintenanceIntervalDays}d`,
    })));

    // 3. Alerts
    console.log('\n--- [3] ACTIVE ALERTS (Collection: alerts) ---');
    const alerts = await Alert.find({}).populate('assetId', 'name department').lean();
    console.table(alerts.map((al) => ({
      ID: al._id.toString().slice(-6),
      Asset: al.assetId?.name || 'N/A',
      Department: al.assetId?.department || 'N/A',
      Severity: al.status,
      Reasons: al.reasons?.join(', ') || 'N/A',
      Acknowledged: al.acknowledged ? 'Yes' : 'No',
      Resolved: al.resolved ? 'Yes' : 'No',
    })));

    // 4. Telemetry Readings Summary
    const readingCount = await Reading.countDocuments();
    const latestReadings = await Reading.find({}).sort({ timestamp: -1 }).limit(3).populate('assetId', 'name').lean();
    console.log(`\n--- [4] TELEMETRY READINGS (Total: ${readingCount} records) ---`);
    console.log('Latest 3 Readings:');
    console.table(latestReadings.map((r) => ({
      Asset: r.assetId?.name || 'N/A',
      Timestamp: new Date(r.timestamp).toLocaleString(),
      RuntimeHours: `${r.runtimeHours} hrs`,
      Temperature: r.temperature !== null ? `${r.temperature}°C` : 'N/A',
      ErrorCode: r.errorCode || 'None',
    })));

    // 5. Maintenance Audit Logs
    console.log('\n--- [5] RECENT MAINTENANCE AUDIT LOGS ---');
    const logs = await MaintenanceLog.find({}).sort({ createdAt: -1 }).limit(4).populate('assetId', 'name').lean();
    console.table(logs.map((l) => ({
      Asset: l.assetId?.name || 'N/A',
      Type: l.type,
      Description: l.description.slice(0, 45) + '...',
      LoggedBy: l.loggedBy ? 'Staff' : 'AI Decision Layer',
    })));

    await mongoose.connection.close();
    console.log('\n✅ All data displayed directly from MongoDB Atlas cloud database.');
  } catch (err) {
    console.error('❌ Error fetching data:', err.message);
    process.exit(1);
  }
}

displayCloudData();
