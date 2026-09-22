import express from 'express';
import {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  getAssetStatus,
  analyzeAsset,
} from '../controllers/assetController.js';
import {
  ingestReading,
  getReadings,
  seedAssetsAndReadings,
} from '../controllers/readingController.js';
import { addLog, getLogs } from '../controllers/logController.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Seed endpoint (Dev-only, no auth strictly required so it can be called in dev/setup easily, or with auth)
router.post('/seed', seedAssetsAndReadings);

// Asset CRUD
router.post('/', protect, requireAdmin, createAsset);
router.get('/', protect, getAssets);
router.get('/:id', protect, getAssetById);
router.put('/:id', protect, requireAdmin, updateAsset);
router.delete('/:id', protect, requireAdmin, deleteAsset);

// Status and AI Analysis
router.get('/:id/status', protect, getAssetStatus);
router.post('/:id/analyze', protect, analyzeAsset);

// Nested Readings
router.post('/:id/readings', protect, ingestReading);
router.get('/:id/readings', protect, getReadings);

// Nested Maintenance Logs
router.post('/:id/logs', protect, addLog);
router.get('/:id/logs', protect, getLogs);

export default router;
