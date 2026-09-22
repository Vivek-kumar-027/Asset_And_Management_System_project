import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/register', protect, requireAdmin, register);
router.get('/me', protect, getMe);

export default router;
