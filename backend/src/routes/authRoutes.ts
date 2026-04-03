import express from 'express';
import { login, getProfile, syncGameData, getGlobalHoF, addToGlobalHoF } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.post('/login',    login);
router.get('/profile',   authMiddleware, getProfile);
router.put('/sync',      authMiddleware, syncGameData);
router.get('/hof',       getGlobalHoF);
router.post('/hof',      authMiddleware, addToGlobalHoF);

export default router;
