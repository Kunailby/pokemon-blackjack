"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.drawCard = exports.createShoe = exports.generateInviteCode = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Card_1 = __importDefault(require("../models/Card"));
const Shoe_1 = __importDefault(require("../models/Shoe"));
const SHOE_SIZE = 208; // 208 cards per shoe
/**
 * Generate a unique invite code
 */
const generateInviteCode = () => {
    return crypto_1.default.randomBytes(4).toString('hex').toUpperCase();
};
exports.generateInviteCode = generateInviteCode;
/**
 * Create a new shoe with 208 random cards
 */
const createShoe = async (gameId) => {
    try {
        // Get all cards from database
        const allCards = await Card_1.default.find();
        if (allCards.length === 0) {
            throw new Error('No cards available in database. Please seed cards first.');
        }
        // Create array with SHOE_SIZE cards (randomly selected with replacement)
        const shoeCards = [];
        for (let i = 0; i < SHOE_SIZE; i++) {
            const randomCard = allCards[Math.floor(Math.random() * allCards.length)];
            shoeCards.push(randomCard._id);
        }
        // Create shoe document
        const shoe = new Shoe_1.default({
            cards: shoeCards,
            gameId: gameId,
            cardsUsed: 0
        });
        await shoe.save();
        return shoe;
    }
    catch (error) {
        console.error('Error creating shoe:', error);
        throw error;
    }
};
exports.createShoe = createShoe;
/**
 * Draw a card from the shoe
 */
const drawCard = async (shoeId) => {
    try {
        const shoe = await Shoe_1.default.findById(shoeId).populate('cards');
        if (!shoe) {
            throw new Error('Shoe not found');
        }
        if (shoe.cardsUsed >= shoe.cards.length) {
            throw new Error('Shoe is empty');
        }
        const card = shoe.cards[shoe.cardsUsed];
        shoe.cardsUsed += 1;
        await shoe.save();
        return card;
    }
    catch (error) {
        console.error('Error drawing card:', error);
        throw error;
    }
};
exports.drawCard = drawCard;
//# sourceMappingURL=ShoeService.js.map