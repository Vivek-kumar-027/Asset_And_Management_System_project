import mongoose from 'mongoose';
import { Asset, MaintenanceLog } from '../models/index.js';

// POST /api/assets/:id/logs
export const addLog = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    // Role check for DepartmentStaff
    if (req.user.role === 'DepartmentStaff' && asset.department !== req.user.department) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You only have access to ${req.user.department} assets`,
      });
    }

    const { description, type } = req.body;

    if (!description || description.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'description is required',
      });
    }

    const logEntry = await MaintenanceLog.create({
      assetId: asset._id,
      type: type || 'manual-entry',
      description: description.trim(),
      loggedBy: req.user._id,
      createdAt: new Date(),
    });

    await logEntry.populate('loggedBy', 'name email role department');

    return res.status(201).json({
      success: true,
      data: logEntry,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// GET /api/assets/:id/logs
export const getLogs = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    // Role check for DepartmentStaff
    if (req.user.role === 'DepartmentStaff' && asset.department !== req.user.department) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You only have access to ${req.user.department} assets`,
      });
    }

    // Full chronological history for that asset
    const logs = await MaintenanceLog.find({ assetId: asset._id })
      .populate('loggedBy', 'name email role department')
      .populate('relatedAlertId', 'status summary reasons resolved')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
