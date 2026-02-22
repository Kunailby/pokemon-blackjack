"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startGame = exports.listAvailableGames = exports.getGameTable = exports.joinGameTable = exports.createGameTable = void 0;
const GameTable_1 = __importDefault(require("../models/GameTable"));
const ShoeService_1 = require("../services/ShoeService");
const createGameTable = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const inviteCode = (0, ShoeService_1.generateInviteCode)();
        // Create shoe
        const shoe = await (0, ShoeService_1.createShoe)(inviteCode);
        // Create game table
        const gameTable = new GameTable_1.default({
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
    }
    catch (error) {
        console.error('Create game error:', error);
        res.status(500).json({ error: 'Failed to create game' });
    }
};
exports.createGameTable = createGameTable;
const joinGameTable = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const { inviteCode } = req.body;
        if (!inviteCode) {
            return res.status(400).json({ error: 'Invite code required' });
        }
        // Find game table
        const gameTable = await GameTable_1.default.findOne({ inviteCode });
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
    }
    catch (error) {
        console.error('Join game error:', error);
        res.status(500).json({ error: 'Failed to join game' });
    }
};
exports.joinGameTable = joinGameTable;
const getGameTable = async (req, res) => {
    try {
        const { tableId } = req.params;
        const gameTable = await GameTable_1.default.findById(tableId).populate('shoeId').populate({
            path: 'players.hand',
            model: 'Card'
        });
        if (!gameTable) {
            return res.status(404).json({ error: 'Game not found' });
        }
        res.json({
            table: gameTable
        });
    }
    catch (error) {
        console.error('Get game error:', error);
        res.status(500).json({ error: 'Failed to get game' });
    }
};
exports.getGameTable = getGameTable;
const listAvailableGames = async (req, res) => {
    try {
        const games = await GameTable_1.default.find({ gameStatus: 'waiting' }).limit(10);
        res.json({
            games: games.map(g => ({
                id: g._id,
                inviteCode: g.inviteCode,
                playerCount: g.players.length,
                maxPlayers: g.maxPlayers,
                dealerName: g.players.find(p => p.userId === g.dealerId)?.username
            }))
        });
    }
    catch (error) {
        console.error('List games error:', error);
        res.status(500).json({ error: 'Failed to list games' });
    }
};
exports.listAvailableGames = listAvailableGames;
const startGame = async (req, res) => {
    try {
        const { tableId } = req.params;
        const gameTable = await GameTable_1.default.findById(tableId);
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
    }
    catch (error) {
        console.error('Start game error:', error);
        res.status(500).json({ error: 'Failed to start game' });
    }
};
exports.startGame = startGame;
//# sourceMappingURL=gameController.js.map