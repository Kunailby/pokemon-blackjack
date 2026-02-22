import express from 'express';
import {
  createGameTable,
  joinGameTable,
  getGameTable,
  listAvailableGames,
  startGame
} from '../controllers/gameController';

const router = express.Router();

// No auth required - username passed in body
router.post('/create', createGameTable);
router.post('/join', joinGameTable);
router.get('/available', listAvailableGames);
router.get('/:tableId', getGameTable);
router.post('/:tableId/start', startGame);

export default router;
