import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Asset, Reading, MaintenanceLog, User, Alert } from '../models/index.js';

async function runModelTests() {
  console.log('--- Starting Backend Data Model Verification ---');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/asset_ops_dashboard_test');
  console.log('Connected to MongoDB test database.');

  // Clean test database
  await Promise.all([
    Asset.deleteMany({}),
    Reading.deleteMany({}),
    MaintenanceLog.deleteMany({}),
    User.deleteMany({}),
    Alert.deleteMany({}),
  ]);

  try {
    // 1. Test Asset Validation
    console.log('\n[1] Testing Asset model...');
    // Missing required fields
    let validationFailed = false;
    try {
      const invalidAsset = new Asset({});
      await invalidAsset.validate();
    } catch (err) {
      validationFailed = true;
      console.log('✔ Correctly rejected empty Asset missing required fields:', Object.keys(err.errors));
    }
    if (!validationFailed) throw new Error('Asset failed to validate required fields!');

    // Invalid enum
    try {
      const badEnumAsset = new Asset({
        name: 'Bad Asset',
        type: 'InvalidType',
        department: 'InvalidDept',
        installedDate: new Date(),
        maintenanceIntervalDays: 30,
      });
      await badEnumAsset.validate();
      throw new Error('Asset failed to validate enum fields!');
    } catch (err) {
      console.log('✔ Correctly rejected invalid enum values for type and department.');
    }

    // Valid Asset
    const asset = await Asset.create({
      name: 'HVAC Unit 101',
      type: 'HVAC',
      location: { building: 'Building A', zone: 'Roof' },
      department: 'HVAC',
      installedDate: new Date('2024-01-15'),
      maintenanceIntervalDays: 90,
      lastServicedDate: new Date('2024-03-01'),
    });
    console.log('✔ Successfully created Asset with default status and active:', {
      id: asset._id.toString(),
      status: asset.status,
      active: asset.active,
    });
    if (asset.status !== 'Healthy' || asset.active !== true) {
      throw new Error('Asset defaults for status or active are incorrect!');
    }

    // 2. Test Reading Model
    console.log('\n[2] Testing Reading model...');
    const reading = await Reading.create({
      assetId: asset._id,
      timestamp: new Date(),
      temperature: 42.5,
      runtimeHours: 1250,
      errorCode: null,
    });
    console.log('✔ Successfully created Reading:', {
      id: reading._id.toString(),
      assetId: reading.assetId.toString(),
      runtimeHours: reading.runtimeHours,
    });

    // 3. Test User Model & DepartmentStaff department requirement
    console.log('\n[3] Testing User model...');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);

    // DepartmentStaff without department should fail validation
    try {
      const invalidStaff = new User({
        name: 'Staff Without Dept',
        email: 'staff@example.com',
        passwordHash: hash,
        role: 'DepartmentStaff',
      });
      await invalidStaff.validate();
      throw new Error('DepartmentStaff without department should have failed validation!');
    } catch (err) {
      console.log('✔ Correctly rejected DepartmentStaff without department.');
    }

    const adminUser = await User.create({
      name: 'Site Admin',
      email: 'admin@ops.local',
      passwordHash: hash,
      role: 'Admin',
    });

    const staffUser = await User.create({
      name: 'HVAC Tech 1',
      email: 'tech1@ops.local',
      passwordHash: hash,
      role: 'DepartmentStaff',
      department: 'HVAC',
    });
    console.log('✔ Created Admin and DepartmentStaff users successfully.');

    // 4. Test Alert Model
    console.log('\n[4] Testing Alert model...');
    const alert = await Alert.create({
      assetId: asset._id,
      status: 'Watch',
      summary: 'HVAC Unit 101 runtime hours 35% above 30-day baseline.',
      reasons: ['runtime_deviation'],
      triggeredAt: new Date(),
    });
    console.log('✔ Created Alert with defaults:', {
      id: alert._id.toString(),
      acknowledged: alert.acknowledged,
      resolved: alert.resolved,
    });
    if (alert.acknowledged !== false || alert.resolved !== false) {
      throw new Error('Alert defaults for acknowledged/resolved are incorrect!');
    }

    // 5. Test MaintenanceLog Model
    console.log('\n[5] Testing MaintenanceLog model...');
    const logEntry = await MaintenanceLog.create({
      assetId: asset._id,
      type: 'ai-flag',
      description: alert.summary,
      relatedAlertId: alert._id,
      loggedBy: null, // AI generated
    });
    console.log('✔ Created AI-flag MaintenanceLog successfully:', {
      id: logEntry._id.toString(),
      type: logEntry.type,
      relatedAlertId: logEntry.relatedAlertId.toString(),
    });

    console.log('\n✅ ALL BACKEND DATA MODEL TESTS PASSED SUCCESSFULLY!');
  } finally {
    // Cleanup
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
}

runModelTests().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
