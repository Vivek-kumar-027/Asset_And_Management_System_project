import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import app from '../server.js';
import axios from 'axios';
import { Asset, Reading, Alert, MaintenanceLog } from '../models/index.js';

let server;
const PORT = 5557;
const BASE_URL = `http://localhost:${PORT}`;

async function runAlertRoutingTests() {
  console.log('=== STARTING ALERT ROUTING & DEDUPLICATION VERIFICATION ===');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/asset_ops_dashboard_test');

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`Alert Routing Test Server running at ${BASE_URL}`);
      resolve();
    });
  });

  try {
    // Seed fresh demo environment
    await axios.post(`${BASE_URL}/api/assets/seed`);

    // Authenticate Admin, Electrical, HVAC personas
    const adminLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@ops.local',
      password: 'Admin@12345',
    });
    const adminToken = adminLogin.data.token;

    const elecLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'electrical@ops.local',
      password: 'Staff@12345',
    });
    const elecToken = elecLogin.data.token;

    const hvacLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'hvac@ops.local',
      password: 'Staff@12345',
    });
    const hvacToken = hvacLogin.data.token;

    // Create a new fresh asset for clean alert lifecycle testing
    console.log('\n[1] Creating a dedicated Electrical asset for alert lifecycle testing...');
    const createRes = await axios.post(
      `${BASE_URL}/api/assets`,
      {
        name: 'Electrical Transformer Unit 9',
        type: 'Generator',
        department: 'Electrical',
        location: { building: 'Substation B', zone: 'Vault 1' },
        maintenanceIntervalDays: 60,
        installedDate: new Date(),
        lastServicedDate: new Date(),
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const asset = createRes.data.data;
    console.log(`✔ Created asset: ${asset.name} (${asset._id}), Status: ${asset.status}`);

    // Verify initially no alerts exist for this asset
    const initialAlerts = await Alert.countDocuments({ assetId: asset._id });
    console.log('✔ Initial alerts count for asset:', initialAlerts);
    if (initialAlerts !== 0) throw new Error('New asset already has alerts!');

    // 2. Test Ingestion causing Critical State
    console.log('\n[2] Ingesting reading with error code and high temperature to trigger Critical status...');
    const now = new Date();
    await axios.post(
      `${BASE_URL}/api/assets/${asset._id}/readings`,
      {
        timestamp: now,
        runtimeHours: 500,
        temperature: 92.5, // Exceeds Generator threshold 85.0 -> Critical
        errorCode: 'ERR_INSULATION_BREAKDOWN', // -> Critical
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    // Verify Asset status is now Critical
    const updatedAsset = await Asset.findById(asset._id);
    console.log('✔ Asset cached status updated to:', updatedAsset.status);
    if (updatedAsset.status !== 'Critical') throw new Error('Asset did not transition to Critical!');

    // Verify exactly 1 Alert created
    const alertsAfterFirst = await Alert.find({ assetId: asset._id, resolved: false });
    console.log(`✔ Active alerts created: ${alertsAfterFirst.length}`);
    if (alertsAfterFirst.length !== 1) throw new Error('Expected exactly 1 alert created!');
    const activeAlert = alertsAfterFirst[0];
    console.log('✔ Alert summary:', activeAlert.summary);
    console.log('✔ Alert reasons:', activeAlert.reasons);

    // Verify automatically created MaintenanceLog of type 'ai-flag'
    const aiFlagLogs = await MaintenanceLog.find({
      assetId: asset._id,
      type: 'ai-flag',
      relatedAlertId: activeAlert._id,
    });
    console.log(`✔ Automatically created MaintenanceLog (ai-flag): ${aiFlagLogs.length} entry`);
    if (aiFlagLogs.length !== 1) throw new Error('Expected exactly 1 ai-flag MaintenanceLog entry!');
    if (aiFlagLogs[0].loggedBy !== null) throw new Error('ai-flag log should have loggedBy: null');

    // 3. Test Alert Deduplication (Spec Section 5 & 8)
    console.log('\n[3] Ingesting 4 consecutive readings while asset remains in Critical state (testing deduplication)...');
    for (let i = 1; i <= 4; i++) {
      const readingTime = new Date(now.getTime() + i * 3600 * 1000);
      await axios.post(
        `${BASE_URL}/api/assets/${asset._id}/readings`,
        {
          timestamp: readingTime,
          runtimeHours: 500 + i * 2,
          temperature: 91.0 + i * 0.2,
          errorCode: 'ERR_INSULATION_BREAKDOWN',
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
    }

    // Verify still exactly 1 Alert document exists for this asset
    const totalAlertsAfterMultiple = await Alert.countDocuments({ assetId: asset._id });
    console.log(`✔ Total Alert documents for asset after 5 total readings: ${totalAlertsAfterMultiple}`);
    if (totalAlertsAfterMultiple !== 1) {
      throw new Error(`Deduplication failed! Expected 1 alert but found ${totalAlertsAfterMultiple}`);
    }

    // Verify still exactly 1 ai-flag log exists for this alert
    const aiFlagLogsAfterMultiple = await MaintenanceLog.countDocuments({
      assetId: asset._id,
      type: 'ai-flag',
    });
    console.log(`✔ Total ai-flag logs after multiple readings: ${aiFlagLogsAfterMultiple}`);
    if (aiFlagLogsAfterMultiple !== 1) {
      throw new Error(`Duplicate ai-flag logs created! Found ${aiFlagLogsAfterMultiple}`);
    }

    // 4. Test Department Alert Queue Visibility
    console.log('\n[4] Testing Department Queue Scoping for this Electrical Alert...');
    const elecAlertsRes = await axios.get(`${BASE_URL}/api/alerts?resolved=false`, {
      headers: { Authorization: `Bearer ${elecToken}` },
    });
    const foundInElecQueue = elecAlertsRes.data.data.some((a) => a._id === activeAlert._id.toString());
    console.log('✔ Alert is present in Electrical Staff queue:', foundInElecQueue);
    if (!foundInElecQueue) throw new Error('Alert not found in Electrical department queue!');

    const hvacAlertsRes = await axios.get(`${BASE_URL}/api/alerts?resolved=false`, {
      headers: { Authorization: `Bearer ${hvacToken}` },
    });
    const foundInHvacQueue = hvacAlertsRes.data.data.some((a) => a._id === activeAlert._id.toString());
    console.log('✔ Alert is absent from HVAC Staff queue:', !foundInHvacQueue);
    if (foundInHvacQueue) throw new Error('Electrical alert leaked into HVAC queue!');

    // 5. Test Acknowledge Flow
    console.log('\n[5] Testing Alert Acknowledge flow...');
    const ackRes = await axios.patch(
      `${BASE_URL}/api/alerts/${activeAlert._id}/acknowledge`,
      {},
      { headers: { Authorization: `Bearer ${elecToken}` } }
    );
    console.log('✔ Acknowledged flag:', ackRes.data.data.acknowledged);
    console.log('✔ Acknowledged by user:', ackRes.data.data.acknowledgedBy.email);
    if (!ackRes.data.data.acknowledged || !ackRes.data.data.acknowledgedAt) {
      throw new Error('Acknowledge failed to set timestamps or flags!');
    }

    // 6. Test Resolve Flow
    console.log('\n[6] Testing Alert Resolve flow...');
    // Empty note -> 400
    try {
      await axios.patch(
        `${BASE_URL}/api/alerts/${activeAlert._id}/resolve`,
        { resolutionNote: '   ' },
        { headers: { Authorization: `Bearer ${elecToken}` } }
      );
      throw new Error('Empty resolutionNote did not return 400!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('✔ Correctly rejected empty resolution note with 400.');
      } else {
        throw err;
      }
    }

    // Valid resolution note -> 200
    const resolveRes = await axios.patch(
      `${BASE_URL}/api/alerts/${activeAlert._id}/resolve`,
      { resolutionNote: 'Replaced degraded insulation bushings and thermal sensor.' },
      { headers: { Authorization: `Bearer ${elecToken}` } }
    );
    console.log('✔ Alert marked resolved:', resolveRes.data.data.resolved === true);
    console.log('✔ Resolution log created:', resolveRes.data.maintenanceLog.description);
    if (!resolveRes.data.data.resolved || resolveRes.data.maintenanceLog.type !== 'resolution') {
      throw new Error('Resolution failed to mark resolved or create resolution log!');
    }

    // Verify asset cached status returned to Healthy
    const assetAfterResolve = await Asset.findById(asset._id);
    console.log('✔ Asset cached status after resolution:', assetAfterResolve.status);
    if (assetAfterResolve.status !== 'Healthy') {
      throw new Error('Asset did not return to Healthy status after all alerts resolved!');
    }

    // 7. Test Subsequent Failure after Resolution creates New Alert
    console.log('\n[7] Testing Subsequent Anomaly after Resolution generates New Alert...');
    await axios.post(
      `${BASE_URL}/api/assets/${asset._id}/readings`,
      {
        timestamp: new Date(now.getTime() + 10 * 3600 * 1000),
        runtimeHours: 520,
        temperature: 95.0, // High temperature again
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    const totalAlertsAfterReoccurrence = await Alert.countDocuments({ assetId: asset._id });
    console.log(`✔ Total alerts for asset after subsequent anomaly: ${totalAlertsAfterReoccurrence}`);
    if (totalAlertsAfterReoccurrence !== 2) {
      throw new Error(`Expected 2 total alerts (1 resolved, 1 active), found ${totalAlertsAfterReoccurrence}`);
    }

    // Verify chronological maintenance log history
    const logsRes = await axios.get(`${BASE_URL}/api/assets/${asset._id}/logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const logTypes = logsRes.data.data.map((l) => l.type);
    console.log('✔ Asset chronological log entries:', logTypes);
    // Should include: ['ai-flag', 'resolution', 'ai-flag']
    if (!logTypes.includes('ai-flag') || !logTypes.includes('resolution')) {
      throw new Error('Audit trail missing expected ai-flag or resolution entries!');
    }

    console.log('\n✅ ALL ALERT ROUTING & DEDUPLICATION TESTS PASSED PERFECTLY!');
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
  }
}

runAlertRoutingTests().catch((err) => {
  console.error('❌ Alert Routing test failed:', err.response ? err.response.data : err.message);
  process.exit(1);
});
