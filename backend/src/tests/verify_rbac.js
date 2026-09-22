import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import app from '../server.js';
import axios from 'axios';
import { User, Asset, Alert } from '../models/index.js';

let server;
const PORT = 5556;
const BASE_URL = `http://localhost:${PORT}`;

async function runRBACTests() {
  console.log('=== STARTING COMPREHENSIVE RBAC & AUTH VERIFICATION ===');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/asset_ops_dashboard_test');

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`RBAC Test Server running at ${BASE_URL}`);
      resolve();
    });
  });

  try {
    // Seed fresh demo environment first
    await axios.post(`${BASE_URL}/api/assets/seed`);

    // 1. Authenticate Admin and DepartmentStaff (Electrical & HVAC)
    console.log('\n[1] Authenticating test personas...');
    const adminLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@ops.local',
      password: 'Admin@12345',
    });
    const adminToken = adminLogin.data.token;

    const electricalLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'electrical@ops.local',
      password: 'Staff@12345',
    });
    const electricalToken = electricalLogin.data.token;

    const hvacLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'hvac@ops.local',
      password: 'Staff@12345',
    });
    const hvacToken = hvacLogin.data.token;

    console.log('✔ All 3 personas authenticated successfully.');

    // 2. Verify Passwords in DB are hashed with bcrypt (never plaintext)
    console.log('\n[2] Verifying bcrypt password hashing in MongoDB...');
    const usersInDb = await User.find({}).lean();
    for (const u of usersInDb) {
      if (!u.passwordHash || !u.passwordHash.startsWith('$2')) {
        throw new Error(`User ${u.email} does not have a valid bcrypt hash! Value: ${u.passwordHash}`);
      }
      if (u.passwordHash.includes('12345') || u.passwordHash.includes('Admin') || u.passwordHash.includes('Staff')) {
        throw new Error(`Plaintext password detected in user record ${u.email}!`);
      }
    }
    console.log(`✔ Verified ${usersInDb.length} users in DB have secure bcrypt hashes. Plaintext never persisted.`);

    // 3. Test POST /api/auth/register RBAC
    console.log('\n[3] Testing POST /api/auth/register permissions...');
    // Attempt by Electrical staff -> 403
    try {
      await axios.post(
        `${BASE_URL}/api/auth/register`,
        {
          name: 'Hacker Tech',
          email: 'hack@ops.local',
          password: 'Password123!',
          role: 'Admin',
        },
        { headers: { Authorization: `Bearer ${electricalToken}` } }
      );
      throw new Error('DepartmentStaff was able to register a user!');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('✔ Correctly denied user registration by DepartmentStaff (403 Forbidden).');
      } else {
        throw err;
      }
    }

    // Attempt by Admin with missing department for DepartmentStaff -> 400
    try {
      await axios.post(
        `${BASE_URL}/api/auth/register`,
        {
          name: 'Staff Without Dept',
          email: 'nodp@ops.local',
          password: 'Password123!',
          role: 'DepartmentStaff',
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      throw new Error('Registration of DepartmentStaff without department succeeded!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('✔ Correctly rejected DepartmentStaff registration missing department (400 Bad Request).');
      } else {
        throw err;
      }
    }

    // Succeeded registration by Admin
    const regRes = await axios.post(
      `${BASE_URL}/api/auth/register`,
      {
        name: 'New HVAC Specialist',
        email: 'specialist@ops.local',
        password: 'Password123!',
        role: 'DepartmentStaff',
        department: 'HVAC',
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log('✔ Successfully registered new staff user as Admin (201 Created):', regRes.data.data.email);

    // 4. Test Cross-Department Asset Access Restrictions
    console.log('\n[4] Testing Cross-Department Asset Boundaries...');
    // Find an HVAC asset
    const hvacAsset = await Asset.findOne({ department: 'HVAC', active: true }).lean();
    if (!hvacAsset) throw new Error('No HVAC asset found in DB!');

    // Electrical staff trying to view HVAC asset details -> 403
    try {
      await axios.get(`${BASE_URL}/api/assets/${hvacAsset._id}`, {
        headers: { Authorization: `Bearer ${electricalToken}` },
      });
      throw new Error('Electrical staff was able to access HVAC asset details!');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('✔ Correctly returned 403 when Electrical staff accessed HVAC asset detail.');
      } else {
        throw err;
      }
    }

    // HVAC staff accessing HVAC asset details -> 200 OK
    const hvacAccessRes = await axios.get(`${BASE_URL}/api/assets/${hvacAsset._id}`, {
      headers: { Authorization: `Bearer ${hvacToken}` },
    });
    console.log('✔ HVAC staff successfully accessed own department asset (200 OK):', hvacAccessRes.data.data.name);

    // 5. Test Cross-Department Ingestion & Logging Boundaries
    console.log('\n[5] Testing Cross-Department Ingestion & Logging Restrictions...');
    // Electrical staff trying to ingest reading on HVAC asset -> 403
    try {
      await axios.post(
        `${BASE_URL}/api/assets/${hvacAsset._id}/readings`,
        { timestamp: new Date(), runtimeHours: 2000 },
        { headers: { Authorization: `Bearer ${electricalToken}` } }
      );
      throw new Error('Electrical staff was able to ingest readings on HVAC asset!');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('✔ Correctly returned 403 when Electrical staff attempted reading ingestion on HVAC asset.');
      } else {
        throw err;
      }
    }

    // Electrical staff trying to add maintenance log on HVAC asset -> 403
    try {
      await axios.post(
        `${BASE_URL}/api/assets/${hvacAsset._id}/logs`,
        { description: 'Unauthorized inspection attempt' },
        { headers: { Authorization: `Bearer ${electricalToken}` } }
      );
      throw new Error('Electrical staff was able to add log on HVAC asset!');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('✔ Correctly returned 403 when Electrical staff attempted log entry on HVAC asset.');
      } else {
        throw err;
      }
    }

    // 6. Test Cross-Department Alert Acknowledge & Resolve Boundaries
    console.log('\n[6] Testing Cross-Department Alert Boundaries...');
    // Find an alert on an HVAC asset
    const hvacAlert = await Alert.findOne({ assetId: hvacAsset._id, resolved: false }).lean();
    if (hvacAlert) {
      // Electrical staff trying to acknowledge HVAC alert -> 403
      try {
        await axios.patch(
          `${BASE_URL}/api/alerts/${hvacAlert._id}/acknowledge`,
          {},
          { headers: { Authorization: `Bearer ${electricalToken}` } }
        );
        throw new Error('Electrical staff was able to acknowledge HVAC alert!');
      } catch (err) {
        if (err.response && err.response.status === 403) {
          console.log('✔ Correctly returned 403 when Electrical staff attempted to acknowledge HVAC alert.');
        } else {
          throw err;
        }
      }

      // Electrical staff trying to resolve HVAC alert -> 403
      try {
        await axios.patch(
          `${BASE_URL}/api/alerts/${hvacAlert._id}/resolve`,
          { resolutionNote: 'Unauthorized resolution' },
          { headers: { Authorization: `Bearer ${electricalToken}` } }
        );
        throw new Error('Electrical staff was able to resolve HVAC alert!');
      } catch (err) {
        if (err.response && err.response.status === 403) {
          console.log('✔ Correctly returned 403 when Electrical staff attempted to resolve HVAC alert.');
        } else {
          throw err;
        }
      }

      // HVAC staff resolving own alert -> 200 OK
      const hvacResolveRes = await axios.patch(
        `${BASE_URL}/api/alerts/${hvacAlert._id}/resolve`,
        { resolutionNote: 'Cleaned compressor coils and replenished coolant.' },
        { headers: { Authorization: `Bearer ${hvacToken}` } }
      );
      console.log('✔ HVAC staff successfully resolved own alert (200 OK):', hvacResolveRes.data.data.resolved);
    } else {
      console.log('ℹ No active HVAC alert found for test.');
    }

    // 7. Test Admin Global Access
    console.log('\n[7] Testing Admin Global Access...');
    const adminAssets = await axios.get(`${BASE_URL}/api/assets`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const depts = new Set(adminAssets.data.data.map((a) => a.department));
    console.log(`✔ Admin retrieved ${adminAssets.data.count} assets across ${depts.size} departments:`, Array.from(depts));
    if (depts.size < 3) throw new Error('Admin did not see multi-department assets!');

    console.log('\n✅ ALL RBAC AND SECURITY VERIFICATION CHECKS PASSED PERFECTLY!');
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
  }
}

runRBACTests().catch((err) => {
  console.error('❌ RBAC verification failed:', err.response ? err.response.data : err.message);
  process.exit(1);
});
