import { Asset, Alert } from '../models/index.js';
import { runAssetAnalysis } from '../services/aiService.js';

// POST /api/assets (Admin only)
export const createAsset = async (req, res) => {
  try {
    const { name, type, location, department, installedDate, maintenanceIntervalDays, lastServicedDate } = req.body;

    // Strict validation requirement from spec Section 5:
    // "Given a request without name, type, department, or maintenanceIntervalDays, the API returns 400 with a validation error."
    if (!name || !type || !department || maintenanceIntervalDays === undefined || maintenanceIntervalDays === null) {
      return res.status(400).json({
        success: false,
        message: 'Validation error: name, type, department, and maintenanceIntervalDays are required',
        missingFields: [
          !name && 'name',
          !type && 'type',
          !department && 'department',
          (maintenanceIntervalDays === undefined || maintenanceIntervalDays === null) && 'maintenanceIntervalDays',
        ].filter(Boolean),
      });
    }

    const asset = await Asset.create({
      name,
      type,
      location,
      department,
      installedDate: installedDate ? new Date(installedDate) : new Date(),
      maintenanceIntervalDays: Number(maintenanceIntervalDays),
      lastServicedDate: lastServicedDate ? new Date(lastServicedDate) : undefined,
      status: 'Healthy',
      active: true,
    });

    return res.status(201).json({
      success: true,
      data: asset,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// GET /api/assets (supports ?location=&type=&department=&status=&includeInactive=)
export const getAssets = async (req, res) => {
  try {
    const { location, type, department, status, includeInactive } = req.query;

    const query = {};

    // By default exclude deactivated assets
    if (includeInactive !== 'true') {
      query.active = true;
    }

    // Role-based department restriction: DepartmentStaff can ONLY see assets in their department
    if (req.user.role === 'DepartmentStaff') {
      query.department = req.user.department;
    } else if (department) {
      query.department = department;
    }

    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    if (location) {
      query.$or = [
        { 'location.building': { $regex: location, $options: 'i' } },
        { 'location.zone': { $regex: location, $options: 'i' } },
      ];
    }

    const assets = await Asset.find(query).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: assets.length,
      data: assets,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET /api/assets/:id
export const getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    // Check department access for DepartmentStaff
    if (req.user.role === 'DepartmentStaff' && asset.department !== req.user.department) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You only have access to ${req.user.department} department assets`,
      });
    }

    return res.status(200).json({
      success: true,
      data: asset,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// PUT /api/assets/:id (Admin only)
export const updateAsset = async (req, res) => {
  try {
    const allowedUpdates = [
      'name',
      'type',
      'location',
      'department',
      'installedDate',
      'maintenanceIntervalDays',
      'lastServicedDate',
      'active',
    ];

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const asset = await Asset.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: asset,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE /api/assets/:id (Soft delete: active: false, Admin only)
export const deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Asset deactivated successfully',
      data: asset,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET /api/assets/:id/status
export const getAssetStatus = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    if (req.user.role === 'DepartmentStaff' && asset.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Get active alert if any
    const activeAlert = await Alert.findOne({ assetId: asset._id, resolved: false }).sort({ triggeredAt: -1 });

    const recommendation = activeAlert
      ? activeAlert.summary
      : `${asset.name} is currently Healthy and performing within normal baselines.`;

    return res.status(200).json({
      success: true,
      status: asset.status,
      recommendation,
      activeAlert: activeAlert || null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/assets/:id/analyze
export const analyzeAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    if (req.user.role === 'DepartmentStaff' && asset.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const result = await runAssetAnalysis(asset._id);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
