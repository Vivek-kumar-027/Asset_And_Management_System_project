import mongoose from 'mongoose';
import { Asset, Reading } from '../models/index.js';
import { runAssetAnalysis } from '../services/aiService.js';
import { seedDatabase } from '../services/seedService.js';

// POST /api/assets/:id/readings
export const ingestReading = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    // Check department permissions for DepartmentStaff
    if (req.user.role === 'DepartmentStaff' && asset.department !== req.user.department) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You only have access to ${req.user.department} assets`,
      });
    }

    const { timestamp, runtimeHours, temperature, errorCode } = req.body;

    if (!timestamp || runtimeHours === undefined || runtimeHours === null) {
      return res.status(400).json({
        success: false,
        message: 'timestamp and runtimeHours are required',
      });
    }

    const reading = await Reading.create({
      assetId: asset._id,
      timestamp: new Date(timestamp),
      runtimeHours: Number(runtimeHours),
      temperature: temperature !== undefined && temperature !== null ? Number(temperature) : null,
      errorCode: errorCode || null,
    });

    // Auto-trigger AI analysis on reading ingestion per Section 5 & 8
    const analysisResult = await runAssetAnalysis(asset._id);

    return res.status(201).json({
      success: true,
      data: reading,
      analysis: analysisResult,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// GET /api/assets/:id/readings?from=&to=
export const getReadings = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    // Role check
    if (req.user.role === 'DepartmentStaff' && asset.department !== req.user.department) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You only have access to ${req.user.department} assets`,
      });
    }

    const { from, to } = req.query;
    const query = { assetId: asset._id };

    if (from || to) {
      query.timestamp = {};
      if (from) {
        query.timestamp.$gte = new Date(from);
      }
      if (to) {
        query.timestamp.$lte = new Date(to);
      }
    }

    // Sorted by timestamp ascending per spec Section 5
    const readings = await Reading.find(query).sort({ timestamp: 1 });

    return res.status(200).json({
      success: true,
      count: readings.length,
      data: readings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// POST /api/assets/seed (Dev-only seed endpoint)
export const seedAssetsAndReadings = async (req, res) => {
  try {
    const seedResult = await seedDatabase();
    return res.status(200).json({
      success: true,
      message: 'Successfully seeded database with users, assets, and 35+ days of readings',
      data: seedResult,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Seed failed: ${error.message}`,
    });
  }
};
