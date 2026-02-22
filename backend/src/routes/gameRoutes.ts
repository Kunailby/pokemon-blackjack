import express from 'express';
import {
  createGameTable,
  joinGameTable,
  getGameTable,
  listAvailableGames,
  startGame
} from '../controllers/gameController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.post('/create', authMiddleware, createGameTable);
router.post('/join', authMiddleware, joinGameTable);
router.get('/available', authMiddleware, listAvailableGames);
router.get('/:tableId', authMiddleware, getGameTable);
router.post('/:tableId/start', authMiddleware, startGame);

export default router;
