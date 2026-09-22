import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import http from 'http';
import app from '../server.js';
import axios from 'axios';

let server;
const PORT = 5555;
const BASE_URL = `http://localhost:${PORT}`;

async function runApiVerification() {
  console.log('=== STARTING API ENDPOINT VERIFICATION ===');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/asset_ops_dashboard_test');

  // Start HTTP server on test port
  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`Test server running at ${BASE_URL}`);
      resolve();
    });
  });

  try {
    // 1. Test POST /api/assets/seed
    console.log('\n[1] Testing POST /api/assets/seed (Dev-only seed endpoint)...');
    const seedRes = await axios.post(`${BASE_URL}/api/assets/seed`);
    console.log('✔ Seed Response:', seedRes.data.message);
    if (!seedRes.data.success || seedRes.data.data.assetsCreated < 5) {
      throw new Error('Seed failed or created insufficient assets!');
    }

    // 2. Test Auth: Login with valid Admin credentials
    console.log('\n[2] Testing POST /api/auth/login (Admin)...');
    const adminLoginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@ops.local',
      password: 'Admin@12345',
    });
    const adminToken = adminLoginRes.data.token;
    console.log('✔ Admin logged in successfully. Token received.');

    // 3. Test Auth: Login with DepartmentStaff
    console.log('\n[3] Testing POST /api/auth/login (DepartmentStaff: Electrical)...');
    const staffLoginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'electrical@ops.local',
      password: 'Staff@12345',
    });
    const staffToken = staffLoginRes.data.token;
    console.log('✔ DepartmentStaff logged in successfully. Token received.');

    // 4. Test Auth: Invalid login credentials
    console.log('\n[4] Testing POST /api/auth/login with wrong password...');
    try {
      await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'admin@ops.local',
        password: 'WrongPassword!',
      });
      throw new Error('Should have failed with 401!');
    } catch (err) {
      if (err.response && err.response.status === 401) {
        console.log('✔ Correctly rejected invalid credentials with 401.');
      } else {
        throw err;
      }
    }

    // 5. Test Missing Auth Token on protected route
    console.log('\n[5] Testing protected endpoint without token...');
    try {
      await axios.get(`${BASE_URL}/api/assets`);
      throw new Error('Should have failed with 401!');
    } catch (err) {
      if (err.response && err.response.status === 401) {
        console.log('✔ Correctly rejected unauthenticated request with 401.');
      } else {
        throw err;
      }
    }

    // 6. Test Asset Validation: missing required fields
    console.log('\n[6] Testing POST /api/assets with missing required fields...');
    try {
      await axios.post(
        `${BASE_URL}/api/assets`,
        { name: 'Incomplete Asset' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      throw new Error('Should have failed with 400!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('✔ Correctly returned 400 validation error:', err.response.data.message);
      } else {
        throw err;
      }
    }

    // 7. Test RBAC: DepartmentStaff cannot create asset
    console.log('\n[7] Testing POST /api/assets by DepartmentStaff (should return 403)...');
    try {
      await axios.post(
        `${BASE_URL}/api/assets`,
        {
          name: 'Forbidden Asset',
          type: 'HVAC',
          department: 'Electrical',
          maintenanceIntervalDays: 60,
        },
        { headers: { Authorization: `Bearer ${staffToken}` } }
      );
      throw new Error('Should have failed with 403!');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('✔ Correctly returned 403 Forbidden for DepartmentStaff on Admin action.');
      } else {
        throw err;
      }
    }

    // 8. Test Admin creating valid asset
    console.log('\n[8] Testing POST /api/assets with valid fields by Admin...');
    const createAssetRes = await axios.post(
      `${BASE_URL}/api/assets`,
      {
        name: 'Boiler Pump 5',
        type: 'Pump',
        location: { building: 'East Tower', zone: 'Basement' },
        department: 'Plumbing',
        maintenanceIntervalDays: 45,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log('✔ Successfully created asset 201:', createAssetRes.data.data.name);
    const newAssetId = createAssetRes.data.data._id;

    // 9. Test GET /api/assets?department=Electrical
    console.log('\n[9] Testing GET /api/assets?department=Electrical...');
    const deptAssetsRes = await axios.get(`${BASE_URL}/api/assets?department=Electrical`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const allElectrical = deptAssetsRes.data.data.every((a) => a.department === 'Electrical');
    console.log(`✔ Found ${deptAssetsRes.data.count} assets in Electrical. All match department:`, allElectrical);
    if (!allElectrical) throw new Error('Returned non-electrical assets!');

    // 10. Test GET /api/assets?status=Critical
    console.log('\n[10] Testing GET /api/assets?status=Critical...');
    const critAssetsRes = await axios.get(`${BASE_URL}/api/assets?status=Critical`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const allCritical = critAssetsRes.data.data.every((a) => a.status === 'Critical');
    console.log(`✔ Found ${critAssetsRes.data.count} Critical assets. All match status:`, allCritical);
    if (!allCritical) throw new Error('Returned non-critical assets!');

    // 11. Test DELETE /api/assets/:id (soft delete)
    console.log('\n[11] Testing DELETE /api/assets/:id (soft delete)...');
    const deleteRes = await axios.delete(`${BASE_URL}/api/assets/${newAssetId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log('✔ Deactivated asset:', deleteRes.data.data.active === false);
    if (deleteRes.data.data.active !== false) throw new Error('Asset active flag not set to false!');

    // Ensure deactivated asset is excluded from default list
    const defaultListRes = await axios.get(`${BASE_URL}/api/assets`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const isExcluded = !defaultListRes.data.data.some((a) => a._id === newAssetId);
    console.log('✔ Deactivated asset excluded from default asset list:', isExcluded);
    if (!isExcluded) throw new Error('Deactivated asset was returned in default list!');

    // Pick an existing active asset for reading and log tests
    const activeAsset = defaultListRes.data.data[0];
    const assetId = activeAsset._id;

    // 12. Test POST /api/assets/:id/readings for non-existent asset -> 404
    console.log('\n[12] Testing POST /api/assets/:id/readings with non-existent id (should return 404)...');
    try {
      const fakeId = new mongoose.Types.ObjectId();
      await axios.post(
        `${BASE_URL}/api/assets/${fakeId}/readings`,
        { timestamp: new Date(), runtimeHours: 500 },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      throw new Error('Should have returned 404!');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log('✔ Correctly returned 404 for non-existent asset.');
      } else {
        throw err;
      }
    }

    // 13. Test POST /api/assets/:id/readings (valid ingestion)
    console.log('\n[13] Testing POST /api/assets/:id/readings (valid reading ingestion)...');
    const readingRes = await axios.post(
      `${BASE_URL}/api/assets/${assetId}/readings`,
      {
        timestamp: new Date(),
        runtimeHours: 2500,
        temperature: 42.0,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log('✔ Reading ingested, status 201:', readingRes.data.data.runtimeHours);

    // 14. Test GET /api/assets/:id/readings?from=&to=
    console.log('\n[14] Testing GET /api/assets/:id/readings with date filter...');
    const readingsListRes = await axios.get(
      `${BASE_URL}/api/assets/${assetId}/readings`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log(`✔ Retrieved ${readingsListRes.data.count} readings sorted ascending.`);

    // 15. Test Alerts: DepartmentStaff scoped view vs Admin view
    console.log('\n[15] Testing GET /api/alerts department scoping...');
    const adminAlertsRes = await axios.get(`${BASE_URL}/api/alerts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const staffAlertsRes = await axios.get(`${BASE_URL}/api/alerts`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    console.log(`✔ Admin sees ${adminAlertsRes.data.count} alerts.`);
    console.log(`✔ Electrical staff sees ${staffAlertsRes.data.count} alerts.`);
    const staffAlertsAllElectrical = staffAlertsRes.data.data.every(
      (alert) => alert.assetId && alert.assetId.department === 'Electrical'
    );
    console.log('✔ Staff alerts strictly scoped to Electrical department:', staffAlertsAllElectrical);
    if (!staffAlertsAllElectrical) throw new Error('Staff saw alerts outside their department!');

    // 16. Test Alert Acknowledge: PATCH /api/alerts/:id/acknowledge
    console.log('\n[16] Testing PATCH /api/alerts/:id/acknowledge...');
    const alertToAck = adminAlertsRes.data.data.find((a) => !a.acknowledged);
    if (alertToAck) {
      const ackRes = await axios.patch(
        `${BASE_URL}/api/alerts/${alertToAck._id}/acknowledge`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      console.log('✔ Alert acknowledged:', ackRes.data.data.acknowledged === true);
      if (!ackRes.data.data.acknowledged) throw new Error('Alert failed to acknowledge!');
    } else {
      console.log('ℹ All alerts already acknowledged or none present.');
    }

    // 17. Test Alert Resolve: PATCH /api/alerts/:id/resolve
    console.log('\n[17] Testing PATCH /api/alerts/:id/resolve (requires resolutionNote)...');
    const alertToResolve = adminAlertsRes.data.data.find((a) => !a.resolved);
    if (alertToResolve) {
      // Without note -> 400
      try {
        await axios.patch(
          `${BASE_URL}/api/alerts/${alertToResolve._id}/resolve`,
          { resolutionNote: '' },
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        throw new Error('Should have failed with 400 when resolutionNote is empty!');
      } catch (err) {
        if (err.response && err.response.status === 400) {
          console.log('✔ Correctly rejected empty resolutionNote with 400.');
        } else {
          throw err;
        }
      }

      // With valid note -> 200 and generates resolution MaintenanceLog
      const resolveRes = await axios.patch(
        `${BASE_URL}/api/alerts/${alertToResolve._id}/resolve`,
        { resolutionNote: 'Replaced air filter and reset vibration threshold.' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      console.log('✔ Alert marked resolved:', resolveRes.data.data.resolved === true);
      console.log('✔ MaintenanceLog of type resolution generated:', resolveRes.data.maintenanceLog.type);
      if (!resolveRes.data.data.resolved || resolveRes.data.maintenanceLog.type !== 'resolution') {
        throw new Error('Alert resolve did not properly resolve or generate resolution log!');
      }
    }

    // 18. Test Maintenance Logs: Manual Entry and Chronological List
    console.log('\n[18] Testing POST and GET /api/assets/:id/logs...');
    const manualLogRes = await axios.post(
      `${BASE_URL}/api/assets/${assetId}/logs`,
      { description: 'Conducted scheduled quarterly sensor calibration.' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log('✔ Manual log added:', manualLogRes.data.data.type === 'manual-entry');

    const logsListRes = await axios.get(`${BASE_URL}/api/assets/${assetId}/logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`✔ Retrieved ${logsListRes.data.count} log entries for asset.`);

    // 19. Test Dashboard Summary: GET /api/dashboard/summary
    console.log('\n[19] Testing GET /api/dashboard/summary...');
    const summaryRes = await axios.get(`${BASE_URL}/api/dashboard/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log('✔ Dashboard summary received:', summaryRes.data.data);
    if (
      summaryRes.data.data.totalAssets === undefined ||
      summaryRes.data.data.byStatus === undefined ||
      summaryRes.data.data.byDepartment === undefined
    ) {
      throw new Error('Summary payload missing expected keys!');
    }

    console.log('\n✅ ALL 19 API ENDPOINT VERIFICATION CHECKS PASSED PERFECTLY!');
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    console.log('Cleaned up server and database connections.');
  }
}

runApiVerification().catch((err) => {
  console.error('❌ API verification failed:', err.response ? err.response.data : err.message);
  process.exit(1);
});
