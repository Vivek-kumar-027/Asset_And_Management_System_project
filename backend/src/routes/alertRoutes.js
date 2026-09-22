import express from 'express';
import {
  getAlerts,
  getAlertById,
  acknowledgeAlert,
  resolveAlert,
} from '../controllers/alertController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getAlerts);
router.get('/:id', protect, getAlertById);
router.patch('/:id/acknowledge', protect, acknowledgeAlert);
router.patch('/:id/resolve', protect, resolveAlert);

export default router;
