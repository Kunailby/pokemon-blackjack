"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCardStats = exports.seedCards = exports.listAllCards = void 0;
const Card_1 = __importDefault(require("../models/Card"));
const CardScraper_1 = require("../services/CardScraper");
const listAllCards = async (req, res) => {
    try {
        const cards = await Card_1.default.find().limit(50);
        res.json({
            count: cards.length,
            cards
        });
    }
    catch (error) {
        console.error('List cards error:', error);
        res.status(500).json({ error: 'Failed to list cards' });
    }
};
exports.listAllCards = listAllCards;
const seedCards = async (req, res) => {
    try {
        // Only allow in development
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ error: 'Cannot seed in production' });
        }
        const cards = await (0, CardScraper_1.seedSampleCards)();
        res.json({
            message: `Seeded ${cards.length} cards`,
            cards
        });
    }
    catch (error) {
        console.error('Seed cards error:', error);
        res.status(500).json({ error: 'Failed to seed cards' });
    }
};
exports.seedCards = seedCards;
const getCardStats = async (req, res) => {
    try {
        const stats = await Card_1.default.collection.aggregate([
            {
                $group: {
                    _id: '$hpCategory',
                    count: { $sum: 1 }
                }
            }
        ]).toArray();
        res.json({
            stats
        });
    }
    catch (error) {
        console.error('Card stats error:', error);
        res.status(500).json({ error: 'Failed to get card stats' });
    }
};
exports.getCardStats = getCardStats;
//# sourceMappingURL=cardController.js.map