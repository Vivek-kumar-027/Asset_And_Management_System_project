import bcrypt from 'bcryptjs';
import { User, Asset, Reading, Alert, MaintenanceLog } from '../models/index.js';
import { runAssetAnalysis } from './aiService.js';

export const seedDatabase = async () => {
  // Clear existing collections
  await Promise.all([
    User.deleteMany({}),
    Asset.deleteMany({}),
    Reading.deleteMany({}),
    Alert.deleteMany({}),
    MaintenanceLog.deleteMany({}),
  ]);

  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('Admin@12345', salt);
  const staffPassword = await bcrypt.hash('Staff@12345', salt);

  // 1. Seed Users
  const admin = await User.create({
    name: 'Chief Facilities Officer',
    email: 'admin@ops.local',
    passwordHash: adminPassword,
    role: 'Admin',
  });

  const staffElectrical = await User.create({
    name: 'Marcus Vance',
    email: 'electrical@ops.local',
    passwordHash: staffPassword,
    role: 'DepartmentStaff',
    department: 'Electrical',
  });

  const staffHvac = await User.create({
    name: 'Elena Rostova',
    email: 'hvac@ops.local',
    passwordHash: staffPassword,
    role: 'DepartmentStaff',
    department: 'HVAC',
  });

  const staffPlumbing = await User.create({
    name: 'David Chen',
    email: 'plumbing@ops.local',
    passwordHash: staffPassword,
    role: 'DepartmentStaff',
    department: 'Plumbing',
  });

  // 2. Seed Assets
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;

  const assetDefs = [
    {
      name: 'Main Generator Alpha',
      type: 'Generator',
      location: { building: 'Facility Central', zone: 'Sub-Basement 1' },
      department: 'Electrical',
      installedDate: new Date(now.getTime() - 365 * msPerDay),
      maintenanceIntervalDays: 90,
      lastServicedDate: new Date(now.getTime() - 25 * msPerDay),
      scenario: 'healthy',
    },
    {
      name: 'Generator 3 (East Wing)',
      type: 'Generator',
      location: { building: 'East Tower', zone: 'Utility Bay 2' },
      department: 'Electrical',
      installedDate: new Date(now.getTime() - 240 * msPerDay),
      maintenanceIntervalDays: 90,
      lastServicedDate: new Date(now.getTime() - 60 * msPerDay),
      scenario: 'watch_runtime_and_error',
    },
    {
      name: 'Primary Chiller 1',
      type: 'HVAC',
      location: { building: 'North Annex', zone: 'Roof Plant Room' },
      department: 'HVAC',
      installedDate: new Date(now.getTime() - 500 * msPerDay),
      maintenanceIntervalDays: 60,
      lastServicedDate: new Date(now.getTime() - 110 * msPerDay), // Severely overdue (> 1.5x)
      scenario: 'critical_temp_and_overdue',
    },
    {
      name: 'Air Handling Unit 4',
      type: 'HVAC',
      location: { building: 'Central Core', zone: 'Floor 4 Mech Room' },
      department: 'HVAC',
      installedDate: new Date(now.getTime() - 180 * msPerDay),
      maintenanceIntervalDays: 45,
      lastServicedDate: new Date(now.getTime() - 20 * msPerDay),
      scenario: 'healthy',
    },
    {
      name: 'High-Capacity Sump Pump B',
      type: 'Pump',
      location: { building: 'Facility Central', zone: 'Basement Sump Pit' },
      department: 'Plumbing',
      installedDate: new Date(now.getTime() - 400 * msPerDay),
      maintenanceIntervalDays: 60,
      lastServicedDate: new Date(now.getTime() - 75 * msPerDay), // Overdue (> 1.0x)
      scenario: 'watch_overdue',
    },
    {
      name: 'Executive Elevator 1',
      type: 'Lift',
      location: { building: 'East Tower', zone: 'Shaft 1' },
      department: 'General',
      installedDate: new Date(now.getTime() - 700 * msPerDay),
      maintenanceIntervalDays: 30,
      lastServicedDate: new Date(now.getTime() - 15 * msPerDay),
      scenario: 'healthy',
    },
    {
      name: 'Data Center CRAC Unit 2',
      type: 'HVAC',
      location: { building: 'West Wing', zone: 'Server Hall B' },
      department: 'IT',
      installedDate: new Date(now.getTime() - 300 * msPerDay),
      maintenanceIntervalDays: 30,
      lastServicedDate: new Date(now.getTime() - 10 * msPerDay),
      scenario: 'critical_error_code',
    },
  ];

  const createdAssets = [];

  for (const def of assetDefs) {
    const asset = await Asset.create({
      name: def.name,
      type: def.type,
      location: def.location,
      department: def.department,
      installedDate: def.installedDate,
      maintenanceIntervalDays: def.maintenanceIntervalDays,
      lastServicedDate: def.lastServicedDate,
      status: 'Healthy',
      active: true,
    });
    createdAssets.push({ asset, scenario: def.scenario, type: def.type });
  }

  // 3. Generate at least 35 days of historical + ongoing daily readings per asset
  const daysOfHistory = 35;
  const allReadings = [];

  for (const { asset, scenario, type } of createdAssets) {
    let currentRuntime = 1000 + Math.floor(Math.random() * 500);

    for (let day = daysOfHistory; day >= 0; day--) {
      const timestamp = new Date(now.getTime() - day * msPerDay);
      let dailyHours = 6 + Math.random() * 2; // Normal daily runtime ~6-8 hours
      let temp = null;
      let errorCode = null;

      // Base temperature by type
      if (type === 'HVAC') temp = 38 + Math.random() * 6; // normal 38-44 C
      else if (type === 'Generator') temp = 68 + Math.random() * 7; // normal 68-75 C
      else if (type === 'Pump') temp = 45 + Math.random() * 5; // normal 45-50 C

      // Apply scenario deviations
      if (scenario === 'watch_runtime_and_error') {
        // Last 7 days runtime spikes by 40%
        if (day <= 7) {
          dailyHours *= 1.45;
        }
        // Error code 2 days ago
        if (day === 2) {
          errorCode = 'ERR_VOLT_UNSTABLE_402';
        }
      } else if (scenario === 'critical_temp_and_overdue') {
        // Recent readings exceed safe temperature limit (>50 for HVAC)
        if (day <= 3) {
          temp = 56.5 + Math.random() * 4;
        }
      } else if (scenario === 'critical_error_code') {
        // Error code in last 24h
        if (day === 1) {
          errorCode = 'ERR_CRAC_COMPRESSOR_TRIP';
        }
        if (day === 0) {
          temp = 54.0;
        }
      }

      currentRuntime += dailyHours;

      allReadings.push({
        assetId: asset._id,
        timestamp,
        temperature: temp ? Math.round(temp * 10) / 10 : null,
        runtimeHours: Math.round(currentRuntime * 10) / 10,
        errorCode,
      });
    }
  }

  await Reading.insertMany(allReadings);

  // 4. Run AI analysis for each asset to establish cached status, alerts, and initial ai-flags
  for (const { asset } of createdAssets) {
    await runAssetAnalysis(asset._id);
  }

  return {
    usersCreated: 4,
    assetsCreated: createdAssets.length,
    readingsCreated: allReadings.length,
    assets: createdAssets.map((c) => ({ id: c.asset._id, name: c.asset.name, department: c.asset.department })),
  };
};
