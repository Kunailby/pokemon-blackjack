"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGameState = exports.dealerTurn = exports.playerStand = exports.playerHit = exports.dealInitialCards = void 0;
const GameTable_1 = __importDefault(require("../models/GameTable"));
const ShoeService_1 = require("../services/ShoeService");
const GameLogic_1 = require("../services/GameLogic");
const dealInitialCards = async (req, res) => {
    try {
        const { tableId } = req.params;
        const gameTable = await GameTable_1.default.findById(tableId).populate('shoeId');
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
                const card = await (0, ShoeService_1.drawCard)(gameTable.shoeId.toString());
                gameTable.players[j].hand.push(card._id);
            }
            // Deal to dealer
            const dealerCard = await (0, ShoeService_1.drawCard)(gameTable.shoeId.toString());
            gameTable.dealer.hand.push(dealerCard._id);
        }
        // Populate and calculate totals
        await gameTable.populate({
            path: 'players.hand',
            model: 'Card'
        });
        gameTable.players.forEach(player => {
            const hpValues = player.hand.map(card => card.hp || 0);
            player.totalHP = (0, GameLogic_1.calculateTotalHP)(hpValues);
        });
        const dealerHpValues = gameTable.dealer.hand.map(card => card.hp || 0);
        gameTable.dealer.totalHP = (0, GameLogic_1.calculateTotalHP)(dealerHpValues);
        await gameTable.save();
        res.json({
            table: gameTable
        });
    }
    catch (error) {
        console.error('Deal cards error:', error);
        res.status(500).json({ error: 'Failed to deal cards' });
    }
};
exports.dealInitialCards = dealInitialCards;
const playerHit = async (req, res) => {
    try {
        const { tableId } = req.params;
        const gameTable = await GameTable_1.default.findById(tableId).populate('shoeId').populate({
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
        if (player.isStanding || (0, GameLogic_1.isBust)(player.totalHP)) {
            return res.status(400).json({ error: 'Cannot hit' });
        }
        // Draw card
        const card = await (0, ShoeService_1.drawCard)(gameTable.shoeId.toString());
        player.hand.push(card._id);
        // Calculate new total
        const hpValues = player.hand.map(h => h.hp || 0);
        player.totalHP = (0, GameLogic_1.calculateTotalHP)(hpValues);
        // Auto-stand if bust or blackjack
        if ((0, GameLogic_1.isBust)(player.totalHP) || (0, GameLogic_1.isBlackjack)(player.totalHP)) {
            player.isStanding = true;
        }
        await gameTable.save();
        res.json({
            table: gameTable,
            player: {
                totalHP: player.totalHP,
                isBust: (0, GameLogic_1.isBust)(player.totalHP),
                isBlackjack: (0, GameLogic_1.isBlackjack)(player.totalHP)
            }
        });
    }
    catch (error) {
        console.error('Player hit error:', error);
        res.status(500).json({ error: 'Failed to draw card' });
    }
};
exports.playerHit = playerHit;
const playerStand = async (req, res) => {
    try {
        const { tableId } = req.params;
        const gameTable = await GameTable_1.default.findById(tableId);
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
    }
    catch (error) {
        console.error('Player stand error:', error);
        res.status(500).json({ error: 'Failed to stand' });
    }
};
exports.playerStand = playerStand;
const dealerTurn = async (req, res) => {
    try {
        const { tableId } = req.params;
        const gameTable = await GameTable_1.default.findById(tableId).populate('shoeId').populate({
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
            const card = await (0, ShoeService_1.drawCard)(gameTable.shoeId.toString());
            gameTable.dealer.hand.push(card._id);
            const hpValues = gameTable.dealer.hand.map(h => h.hp || 0);
            gameTable.dealer.totalHP = (0, GameLogic_1.calculateTotalHP)(hpValues);
        }
        gameTable.dealer.isStanding = true;
        // Determine winners
        const results = gameTable.players.map(player => {
            const outcome = (0, GameLogic_1.determineOutcome)(player.totalHP, gameTable.dealer.totalHP);
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
    }
    catch (error) {
        console.error('Dealer turn error:', error);
        res.status(500).json({ error: 'Failed to complete dealer turn' });
    }
};
exports.dealerTurn = dealerTurn;
const getGameState = async (req, res) => {
    try {
        const { tableId } = req.params;
        const gameTable = await GameTable_1.default.findById(tableId).populate({
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
            const hpValues = player.hand.map((h) => h.hp || 0);
            player.totalHP = (0, GameLogic_1.calculateTotalHP)(hpValues);
        });
        const dealerHpValues = gameTable.dealer.hand.map((h) => h.hp || 0);
        gameTable.dealer.totalHP = (0, GameLogic_1.calculateTotalHP)(dealerHpValues);
        res.json({
            table: gameTable,
            dealer: {
                hand: gameTable.dealer.hand,
                totalHP: gameTable.dealer.totalHP,
                isStanding: gameTable.dealer.isStanding
            }
        });
    }
    catch (error) {
        console.error('Get game state error:', error);
        res.status(500).json({ error: 'Failed to get game state' });
    }
};
exports.getGameState = getGameState;
//# sourceMappingURL=playController.js.map