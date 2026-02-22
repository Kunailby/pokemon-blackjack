import express from 'express';
import { listAllCards, seedCards, getCardStats } from '../controllers/cardController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.get('/list', authMiddleware, listAllCards);
router.get('/stats', authMiddleware, getCardStats);
router.post('/seed', seedCards); // No auth for dev seeding

export default router;
