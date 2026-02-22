"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedSampleCards = exports.saveScrappedCards = exports.scrapeCardsFromSet = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const Card_1 = __importDefault(require("../models/Card"));
const GameLogic_1 = require("./GameLogic");
/**
 * Scrape cards from a specific set
 */
const scrapeCardsFromSet = async (setUrl) => {
    try {
        const response = await axios_1.default.get(setUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const $ = cheerio.load(response.data);
        const cards = [];
        // This is a basic selector - adjust based on actual website structure
        $('div.card-item').each((index, element) => {
            try {
                const $card = $(element);
                const name = $card.find('h3.card-name').text().trim();
                const hpText = $card.find('span.card-hp').text().trim();
                const hp = parseInt(hpText) || 0;
                const imageUrl = $card.find('img.card-image').attr('src') || '';
                const cardNumber = $card.find('span.card-number').text().trim();
                if (name && hp > 0 && imageUrl) {
                    cards.push({
                        name,
                        hp,
                        imageUrl,
                        pokemonId: `${setUrl}-${index}`,
                        setName: setUrl.split('/').pop() || 'unknown',
                        cardNumber
                    });
                }
            }
            catch (error) {
                console.error('Error parsing card:', error);
            }
        });
        return cards;
    }
    catch (error) {
        console.error('Error scraping cards:', error);
        return [];
    }
};
exports.scrapeCardsFromSet = scrapeCardsFromSet;
/**
 * Save scraped cards to database
 */
const saveScrappedCards = async (cards) => {
    try {
        const savedCards = [];
        for (const cardData of cards) {
            // Check if card already exists
            const exists = await Card_1.default.findOne({
                pokemonId: cardData.pokemonId
            });
            if (!exists) {
                const card = new Card_1.default({
                    ...cardData,
                    hpCategory: (0, GameLogic_1.categorizeCard)(cardData.hp)
                });
                await card.save();
                savedCards.push(card);
            }
        }
        return savedCards;
    }
    catch (error) {
        console.error('Error saving scraped cards:', error);
        throw error;
    }
};
exports.saveScrappedCards = saveScrappedCards;
/**
 * Seed sample Pokemon cards (for development/testing)
 */
const seedSampleCards = async () => {
    const sampleCards = [
        { name: 'Charizard', hp: 120, imageUrl: 'https://via.placeholder.com/150', pokemonId: 'charizard-1', setName: 'Base Set', cardNumber: '4/102' },
        { name: 'Blastoise', hp: 100, imageUrl: 'https://via.placeholder.com/150', pokemonId: 'blastoise-1', setName: 'Base Set', cardNumber: '2/102' },
        { name: 'Venusaur', hp: 80, imageUrl: 'https://via.placeholder.com/150', pokemonId: 'venusaur-1', setName: 'Base Set', cardNumber: '15/102' },
        { name: 'Pikachu', hp: 40, imageUrl: 'https://via.placeholder.com/150', pokemonId: 'pikachu-1', setName: 'Base Set', cardNumber: '25/102' },
        { name: 'Dragonite', hp: 180, imageUrl: 'https://via.placeholder.com/150', pokemonId: 'dragonite-1', setName: 'Base Set', cardNumber: '5/102' },
        { name: 'Mewtwo', hp: 60, imageUrl: 'https://via.placeholder.com/150', pokemonId: 'mewtwo-1', setName: 'Base Set', cardNumber: '10/102' },
        { name: 'Machamp', hp: 130, imageUrl: 'https://via.placeholder.com/150', pokemonId: 'machamp-1', setName: 'Base Set', cardNumber: '1/102' },
        { name: 'Gengar', hp: 70, imageUrl: 'https://via.placeholder.com/150', pokemonId: 'gengar-1', setName: 'Base Set', cardNumber: '35/102' }
    ];
    try {
        const createdCards = [];
        for (const cardData of sampleCards) {
            const exists = await Card_1.default.findOne({ pokemonId: cardData.pokemonId });
            if (!exists) {
                const card = new Card_1.default({
                    ...cardData,
                    hpCategory: (0, GameLogic_1.categorizeCard)(cardData.hp)
                });
                await card.save();
                createdCards.push(card);
            }
        }
        console.log(`Seeded ${createdCards.length} sample cards`);
        return createdCards;
    }
    catch (error) {
        console.error('Error seeding cards:', error);
        throw error;
    }
};
exports.seedSampleCards = seedSampleCards;
//# sourceMappingURL=CardScraper.js.map