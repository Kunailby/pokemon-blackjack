import { Response } from 'express';
import GameTable from '../models/GameTable';
import Shoe from '../models/Shoe';
import Card from '../models/Card';
import { AuthRequest } from '../middleware/auth';
import { generateInviteCode, createShoe } from '../services/ShoeService';

export const createGameTable = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const inviteCode = generateInviteCode();
    
    // Create shoe
    const shoe = await createShoe(inviteCode);

    // Create game table
    const gameTable = new GameTable({
      inviteCode,
      dealerId: req.userId,
      players: [{
        userId: req.userId,
        username: req.username || 'Player',
        hand: [],
        totalHP: 0,
        isStanding: false,
        chipsBet: 0
      }],
      shoeId: shoe._id,
      gameStatus: 'waiting'
    });

    await gameTable.save();

    res.status(201).json({
      table: {
        id: gameTable._id,
        inviteCode: gameTable.inviteCode,
        players: gameTable.players,
        maxPlayers: gameTable.maxPlayers,
        gameStatus: gameTable.gameStatus
      }
    });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
};

export const joinGameTable = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code required' });
    }

    // Find game table
    const gameTable = await GameTable.findOne({ inviteCode });
    if (!gameTable) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check if player already in game
    if (gameTable.players.some(p => p.userId === req.userId)) {
      return res.status(409).json({ error: 'Already in this game' });
    }

    // Check max players
    if (gameTable.players.length >= gameTable.maxPlayers) {
      return res.status(409).json({ error: 'Game is full' });
    }

    // Add player
    gameTable.players.push({
      userId: req.userId,
      username: req.username || 'Player',
      hand: [],
      totalHP: 0,
      isStanding: false,
      chipsBet: 0
    });

    await gameTable.save();

    res.json({
      table: {
        id: gameTable._id,
        inviteCode: gameTable.inviteCode,
        players: gameTable.players,
        maxPlayers: gameTable.maxPlayers,
        gameStatus: gameTable.gameStatus
      }
    });
  } catch (error) {
    console.error('Join game error:', error);
    res.status(500).json({ error: 'Failed to join game' });
  }
};

export const getGameTable = async (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.params;

    const gameTable = await GameTable.findById(tableId).populate('shoeId').populate({
      path: 'players.hand',
      model: 'Card'
    });

    if (!gameTable) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json({
      table: gameTable
    });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Failed to get game' });
  }
};

export const listAvailableGames = async (req: AuthRequest, res: Response) => {
  try {
    const games = await GameTable.find({ gameStatus: 'waiting' }).limit(10);

    res.json({
      games: games.map(g => ({
        id: g._id,
        inviteCode: g.inviteCode,
        playerCount: g.players.length,
        maxPlayers: g.maxPlayers,
        dealerName: g.players.find(p => p.userId === g.dealerId)?.username
      }))
    });
  } catch (error) {
    console.error('List games error:', error);
    res.status(500).json({ error: 'Failed to list games' });
  }
};

export const startGame = async (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.params;

    const gameTable = await GameTable.findById(tableId);
    if (!gameTable) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Only dealer can start
    if (gameTable.dealerId !== req.userId) {
      return res.status(403).json({ error: 'Only dealer can start game' });
    }

    // Need at least 2 players
    if (gameTable.players.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 players to start' });
    }

    gameTable.gameStatus = 'in-progress';
    await gameTable.save();

    res.json({
      table: gameTable
    });
  } catch (error) {
    console.error('Start game error:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
};
