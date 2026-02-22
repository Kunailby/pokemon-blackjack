import express from 'express';
import {
  dealInitialCards,
  playerHit,
  playerStand,
  dealerTurn,
  getGameState
} from '../controllers/playController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.post('/:tableId/deal', authMiddleware, dealInitialCards);
router.post('/:tableId/hit', authMiddleware, playerHit);
router.post('/:tableId/stand', authMiddleware, playerStand);
router.post('/:tableId/dealer-turn', authMiddleware, dealerTurn);
router.get('/:tableId/state', authMiddleware, getGameState);

export default router;
