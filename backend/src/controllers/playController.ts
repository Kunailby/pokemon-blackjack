import { Response } from 'express';
import GameTable from '../models/GameTable';
import { AuthRequest } from '../middleware/auth';
import { drawCard } from '../services/ShoeService';
import { calculateTotalHP, isBlackjack, isBust, determineOutcome } from '../services/GameLogic';

export const dealInitialCards = async (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.params;

    const gameTable = await GameTable.findById(tableId).populate('shoeId');
    if (!gameTable) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Only dealer can deal
    if (gameTable.dealerId !== req.userId) {
      return res.status(403).json({ error: 'Only dealer can deal cards' });
    }

    if (gameTable.gameStatus !== 'in-progress') {
      return res.status(400).json({ error: 'Game not in progress' });
    }

    // Deal 2 cards to each player and dealer
    for (let i = 0; i < 2; i++) {
      // Deal to players
      for (let j = 0; j < gameTable.players.length; j++) {
        const card = await drawCard(gameTable.shoeId.toString());
        gameTable.players[j].hand.push(card._id as any);
      }

      // Deal to dealer
      const dealerCard = await drawCard(gameTable.shoeId.toString());
      gameTable.dealer.hand.push(dealerCard._id as any);
    }

    // Populate and calculate totals
    await gameTable.populate({
      path: 'players.hand',
      model: 'Card'
    });

    gameTable.players.forEach(player => {
      const hpValues = (player.hand as any[]).map(card => card.hp || 0);
      player.totalHP = calculateTotalHP(hpValues);
    });

    const dealerHpValues = (gameTable.dealer.hand as any[]).map(card => card.hp || 0);
    gameTable.dealer.totalHP = calculateTotalHP(dealerHpValues);

    await gameTable.save();

    res.json({
      table: gameTable
    });
  } catch (error) {
    console.error('Deal cards error:', error);
    res.status(500).json({ error: 'Failed to deal cards' });
  }
};

export const playerHit = async (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.params;

    const gameTable = await GameTable.findById(tableId).populate('shoeId').populate({
      path: 'players.hand',
      model: 'Card'
    });

    if (!gameTable) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Find player
    const playerIndex = gameTable.players.findIndex(p => p.userId === req.userId);
    if (playerIndex === -1) {
      return res.status(403).json({ error: 'Not in this game' });
    }

    const player = gameTable.players[playerIndex];

    // Check if already standing or busted
    if (player.isStanding || isBust(player.totalHP)) {
      return res.status(400).json({ error: 'Cannot hit' });
    }

    // Draw card
    const card = await drawCard(gameTable.shoeId.toString());
    player.hand.push(card._id as any);

    // Calculate new total
    const hpValues = (player.hand as any[]).map(h => h.hp || 0);
    player.totalHP = calculateTotalHP(hpValues);

    // Auto-stand if bust or blackjack
    if (isBust(player.totalHP) || isBlackjack(player.totalHP)) {
      player.isStanding = true;
    }

    await gameTable.save();

    res.json({
      table: gameTable,
      player: {
        totalHP: player.totalHP,
        isBust: isBust(player.totalHP),
        isBlackjack: isBlackjack(player.totalHP)
      }
    });
  } catch (error) {
    console.error('Player hit error:', error);
    res.status(500).json({ error: 'Failed to draw card' });
  }
};

export const playerStand = async (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.params;

    const gameTable = await GameTable.findById(tableId);
    if (!gameTable) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Find player
    const playerIndex = gameTable.players.findIndex(p => p.userId === req.userId);
    if (playerIndex === -1) {
      return res.status(403).json({ error: 'Not in this game' });
    }

    gameTable.players[playerIndex].isStanding = true;

    // Check if all players have stood
    const allStanding = gameTable.players.every(p => p.isStanding);

    if (allStanding) {
      // Start dealer turn
      gameTable.gameStatus = 'finished';
    }

    await gameTable.save();

    res.json({
      table: gameTable,
      allPlayersStanding: allStanding
    });
  } catch (error) {
    console.error('Player stand error:', error);
    res.status(500).json({ error: 'Failed to stand' });
  }
};

export const dealerTurn = async (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.params;

    const gameTable = await GameTable.findById(tableId).populate('shoeId').populate({
      path: 'dealer.hand',
      model: 'Card'
    });

    if (!gameTable) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Only dealer can perform this
    if (gameTable.dealerId !== req.userId) {
      return res.status(403).json({ error: 'Only dealer can perform this action' });
    }

    // Dealer hits on <300 HP
    const DEALER_STAND_HP = 300;
    while (gameTable.dealer.totalHP < DEALER_STAND_HP) {
      const card = await drawCard(gameTable.shoeId.toString());
      gameTable.dealer.hand.push(card._id as any);

      const hpValues = (gameTable.dealer.hand as any[]).map(h => h.hp || 0);
      gameTable.dealer.totalHP = calculateTotalHP(hpValues);
    }

    gameTable.dealer.isStanding = true;

    // Determine winners
    const results = gameTable.players.map(player => {
      const outcome = determineOutcome(player.totalHP, gameTable.dealer.totalHP);
      return {
        userId: player.userId,
        result: outcome.playerResult,
        playerHP: outcome.playerFinalHP,
        dealerHP: outcome.dealerFinalHP
      };
    });

    gameTable.gameStatus = 'finished';
    await gameTable.save();

    res.json({
      table: gameTable,
      results
    });
  } catch (error) {
    console.error('Dealer turn error:', error);
    res.status(500).json({ error: 'Failed to complete dealer turn' });
  }
};

export const getGameState = async (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.params;

    const gameTable = await GameTable.findById(tableId).populate({
      path: 'players.hand',
      model: 'Card'
    }).populate({
      path: 'dealer.hand',
      model: 'Card'
    });

    if (!gameTable) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Recalculate totals
    gameTable.players.forEach(player => {
      const hpValues = player.hand.map((h: any) => h.hp || 0);
      player.totalHP = calculateTotalHP(hpValues);
    });

    const dealerHpValues = gameTable.dealer.hand.map((h: any) => h.hp || 0);
    gameTable.dealer.totalHP = calculateTotalHP(dealerHpValues);

    res.json({
      table: gameTable,
      dealer: {
        hand: gameTable.dealer.hand,
        totalHP: gameTable.dealer.totalHP,
        isStanding: gameTable.dealer.isStanding
      }
    });
  } catch (error) {
    console.error('Get game state error:', error);
    res.status(500).json({ error: 'Failed to get game state' });
  }
};
