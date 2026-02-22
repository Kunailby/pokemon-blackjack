import express from 'express';
import { register, login, getProfile } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();


// Only username login
router.post('/login', login);
router.get('/profile', authMiddleware, getProfile);

export default router;
