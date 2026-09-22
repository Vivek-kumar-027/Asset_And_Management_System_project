import mongoose from 'mongoose';
import { Alert, Asset, MaintenanceLog } from '../models/index.js';

// GET /api/alerts (supports ?department=&status=&acknowledged=&resolved=)
export const getAlerts = async (req, res) => {
  try {
    const { department, status, acknowledged, resolved } = req.query;

    const alertQuery = {};

    if (status) {
      alertQuery.status = status;
    }

    if (acknowledged !== undefined) {
      alertQuery.acknowledged = acknowledged === 'true';
    }

    if (resolved !== undefined) {
      alertQuery.resolved = resolved === 'true';
    }

    // Role-based filtering by asset department
    const assetQuery = {};
    if (req.user.role === 'DepartmentStaff') {
      assetQuery.department = req.user.department;
    } else if (department) {
      assetQuery.department = department;
    }

    // Find matching asset IDs if department filter applies
    if (req.user.role === 'DepartmentStaff' || department) {
      const matchingAssets = await Asset.find(assetQuery).select('_id');
      const assetIds = matchingAssets.map((a) => a._id);
      alertQuery.assetId = { $in: assetIds };
    }

    const alerts = await Alert.find(alertQuery)
      .populate('assetId', 'name type department location status active')
      .populate('acknowledgedBy', 'name email role')
      .sort({ triggeredAt: -1 });

    return res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET /api/alerts/:id
export const getAlertById = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('assetId', 'name type department location status active')
      .populate('acknowledgedBy', 'name email role');

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    // Role check for DepartmentStaff
    if (
      req.user.role === 'DepartmentStaff' &&
      alert.assetId &&
      alert.assetId.department !== req.user.department
    ) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You only have access to ${req.user.department} department alerts`,
      });
    }

    return res.status(200).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// PATCH /api/alerts/:id/acknowledge
export const acknowledgeAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id).populate('assetId', 'department');

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    // Role check for DepartmentStaff
    if (
      req.user.role === 'DepartmentStaff' &&
      alert.assetId &&
      alert.assetId.department !== req.user.department
    ) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You only have access to ${req.user.department} department alerts`,
      });
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = req.user._id;
    alert.acknowledgedAt = new Date();
    await alert.save();

    await alert.populate('acknowledgedBy', 'name email role');

    return res.status(200).json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: alert,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// PATCH /api/alerts/:id/resolve
export const resolveAlert = async (req, res) => {
  try {
    const { resolutionNote } = req.body;

    if (!resolutionNote || resolutionNote.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Non-empty resolutionNote is required to resolve an alert',
      });
    }

    const alert = await Alert.findById(req.params.id).populate('assetId');

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    // Role check for DepartmentStaff
    if (
      req.user.role === 'DepartmentStaff' &&
      alert.assetId &&
      alert.assetId.department !== req.user.department
    ) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You only have access to ${req.user.department} department alerts`,
      });
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolutionNote = resolutionNote.trim();
    if (!alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedBy = req.user._id;
      alert.acknowledgedAt = new Date();
    }
    await alert.save();

    // Automatically create a MaintenanceLog entry of type 'resolution' linked via relatedAlertId
    const logEntry = await MaintenanceLog.create({
      assetId: alert.assetId._id,
      type: 'resolution',
      description: `Resolved alert (${alert.status}): ${resolutionNote.trim()}`,
      loggedBy: req.user._id,
      relatedAlertId: alert._id,
      createdAt: new Date(),
    });

    // Check if there are other unresolved alerts on the asset
    const remainingAlerts = await Alert.find({
      assetId: alert.assetId._id,
      resolved: false,
    });

    if (remainingAlerts.length === 0) {
      // Return asset cached status to Healthy
      await Asset.findByIdAndUpdate(alert.assetId._id, {
        status: 'Healthy',
        lastServicedDate: new Date(),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Alert resolved successfully and resolution logged',
      data: alert,
      maintenanceLog: logEntry,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
