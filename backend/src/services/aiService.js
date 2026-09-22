import axios from 'axios';
import { Asset, Reading, Alert, MaintenanceLog } from '../models/index.js';

// Fallback rule-based analysis matching spec Section 6 in case Python microservice is booting or offline
function evaluateRulesFallback(asset, readings) {
  const reasons = [];
  let status = 'Healthy';

  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;

  // Rule 3: Maintenance overdue
  if (asset.lastServicedDate && asset.maintenanceIntervalDays) {
    const daysSinceService = (now - new Date(asset.lastServicedDate)) / msPerDay;
    if (daysSinceService > 1.5 * asset.maintenanceIntervalDays) {
      status = 'Critical';
      reasons.push('maintenance_severely_overdue');
    } else if (daysSinceService > asset.maintenanceIntervalDays) {
      if (status !== 'Critical') status = 'Watch';
      reasons.push('maintenance_overdue');
    }
  }

  // Sort readings by timestamp ascending
  const sorted = [...readings].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Rule 2: Recent error code in last 48 hours
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const recentError = sorted.some(
    (r) => new Date(r.timestamp) >= fortyEightHoursAgo && r.errorCode && r.errorCode.trim() !== ''
  );
  if (recentError) {
    status = 'Critical';
    reasons.push('recent_error');
  }

  // Rule 4: Temperature threshold
  const tempThresholds = {
    HVAC: 50,
    Generator: 85,
    Pump: 65,
    Lift: 50,
    Other: 60,
  };
  const maxTemp = tempThresholds[asset.type] || 60;
  const recentReadings = sorted.filter((r) => new Date(r.timestamp) >= fortyEightHoursAgo);
  const tempExceeded = recentReadings.some(
    (r) => typeof r.temperature === 'number' && r.temperature > maxTemp
  );
  if (tempExceeded) {
    status = 'Critical';
    reasons.push('temperature_exceeded');
  }

  // Rule 1: Runtime deviation (7-day runtime vs 30-day daily average)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * msPerDay);
  const sevenDaysAgo = new Date(now.getTime() - 7 * msPerDay);

  const readings30 = sorted.filter((r) => new Date(r.timestamp) >= thirtyDaysAgo);
  const readings7 = sorted.filter((r) => new Date(r.timestamp) >= sevenDaysAgo);

  if (readings30.length >= 2 && readings7.length >= 2) {
    const runtime30 = readings30[readings30.length - 1].runtimeHours - readings30[0].runtimeHours;
    const runtime7 = readings7[readings7.length - 1].runtimeHours - readings7[0].runtimeHours;

    const days30 = Math.max(1, (new Date(readings30[readings30.length - 1].timestamp) - new Date(readings30[0].timestamp)) / msPerDay);
    const days7 = Math.max(1, (new Date(readings7[readings7.length - 1].timestamp) - new Date(readings7[0].timestamp)) / msPerDay);

    const dailyAvg30 = runtime30 / days30;
    const dailyAvg7 = runtime7 / days7;

    if (dailyAvg30 > 0) {
      const deviation = (dailyAvg7 - dailyAvg30) / dailyAvg30;
      if (deviation > 0.5) {
        status = 'Critical';
        reasons.push('runtime_deviation_severe');
      } else if (deviation > 0.25) {
        if (status !== 'Critical') status = 'Watch';
        reasons.push('runtime_deviation');
      }
    }
  }

  // Plain-language summary generation
  let summary = `${asset.name} is operating normally with no detected anomalies.`;
  if (reasons.length > 0) {
    const reasonPhrases = reasons.map((r) => {
      switch (r) {
        case 'runtime_deviation_severe':
          return 'runtime hours are >50% above the 30-day baseline';
        case 'runtime_deviation':
          return 'runtime hours are >25% above the 30-day baseline';
        case 'recent_error':
          return 'an error code was logged within the past 48 hours';
        case 'maintenance_severely_overdue':
          return 'scheduled maintenance is overdue by more than 150%';
        case 'maintenance_overdue':
          return 'scheduled maintenance interval has been exceeded';
        case 'temperature_exceeded':
          return 'operating temperature exceeded safe operational limits';
        default:
          return r;
      }
    });

    const action = status === 'Critical' ? 'Immediate inspection required.' : 'Recommend inspection soon.';
    summary = `${asset.name} flagged as ${status}: ${reasonPhrases.join('; ')}. ${action}`;
  }

  return { status, reasons, summary };
}

export const runAssetAnalysis = async (assetId) => {
  const asset = await Asset.findById(assetId);
  if (!asset) {
    throw new Error('Asset not found');
  }

  // Fetch readings for analysis (up to past 45 days)
  const readings = await Reading.find({ assetId }).sort({ timestamp: 1 }).lean();

  let analysisResult;
  const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

  try {
    const response = await axios.post(
      `${pythonUrl}/analyze`,
      {
        asset: {
          id: asset._id.toString(),
          name: asset.name,
          type: asset.type,
          department: asset.department,
          installedDate: asset.installedDate,
          maintenanceIntervalDays: asset.maintenanceIntervalDays,
          lastServicedDate: asset.lastServicedDate,
        },
        readings: readings.map((r) => ({
          timestamp: r.timestamp,
          temperature: r.temperature,
          runtimeHours: r.runtimeHours,
          errorCode: r.errorCode,
        })),
      },
      { timeout: 3000 }
    );
    analysisResult = response.data;
  } catch (err) {
    // If Python service is down or in dev, use fallback engine
    analysisResult = evaluateRulesFallback(asset, readings);
  }

  const { status, reasons, summary } = analysisResult;

  // 1. Update Asset cached status
  asset.status = status;
  await asset.save();

  // 2. Handle Alert and MaintenanceLog if Watch or Critical
  if (status === 'Watch' || status === 'Critical') {
    // Find if there is an active (unresolved) alert
    let alert = await Alert.findOne({ assetId: asset._id, resolved: false });

    if (!alert) {
      // Create new alert
      alert = await Alert.create({
        assetId: asset._id,
        status,
        summary,
        reasons,
        triggeredAt: new Date(),
        acknowledged: false,
        resolved: false,
      });

      // Automatically create a MaintenanceLog entry of type 'ai-flag'
      await MaintenanceLog.create({
        assetId: asset._id,
        type: 'ai-flag',
        description: summary,
        relatedAlertId: alert._id,
        loggedBy: null,
      });
    } else {
      // Update existing active alert
      alert.status = status;
      alert.summary = summary;
      alert.reasons = reasons;
      alert.triggeredAt = new Date();
      await alert.save();
    }
  }

  return { status, reasons, summary };
};
