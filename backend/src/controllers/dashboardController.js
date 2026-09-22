import { Asset, Alert } from '../models/index.js';

// GET /api/dashboard/summary
export const getSummary = async (req, res) => {
  try {
    const assetFilter = { active: true };
    const alertFilter = { resolved: false };

    if (req.user.role === 'DepartmentStaff') {
      assetFilter.department = req.user.department;
    }

    // Status breakdown
    const statusCountsRaw = await Asset.aggregate([
      { $match: assetFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const byStatus = {
      Healthy: 0,
      Watch: 0,
      Critical: 0,
    };
    let totalAssets = 0;

    statusCountsRaw.forEach((item) => {
      if (byStatus[item._id] !== undefined) {
        byStatus[item._id] = item.count;
      }
      totalAssets += item.count;
    });

    // Department breakdown
    const deptCountsRaw = await Asset.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
    ]);

    const byDepartment = {
      Electrical: 0,
      HVAC: 0,
      Plumbing: 0,
      IT: 0,
      General: 0,
    };

    deptCountsRaw.forEach((item) => {
      if (byDepartment[item._id] !== undefined) {
        byDepartment[item._id] = item.count;
      }
    });

    // Active alerts count
    let activeAlertsCount = 0;
    if (req.user.role === 'DepartmentStaff') {
      const deptAssets = await Asset.find({ department: req.user.department }).select('_id');
      const deptAssetIds = deptAssets.map((a) => a._id);
      activeAlertsCount = await Alert.countDocuments({
        assetId: { $in: deptAssetIds },
        resolved: false,
      });
    } else {
      activeAlertsCount = await Alert.countDocuments({ resolved: false });
    }

    return res.status(200).json({
      success: true,
      data: {
        totalAssets,
        activeAlerts: activeAlertsCount,
        byStatus,
        byDepartment,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
