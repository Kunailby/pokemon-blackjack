import axios from 'axios';
import * as cheerio from 'cheerio';
import Card, { ICard } from '../models/Card';
import { categorizeCard } from './GameLogic';

/**
 * Scrape Pokemon cards from pkmncards.com
 * NOTE: This is a basic scraper. Actual implementation may need adjustments
 * based on website structure changes.
 */

interface ScrapedCardData {
  name: string;
  hp: number;
  imageUrl: string;
  pokemonId: string;
  setName: string;
  cardNumber: string;
}

/**
 * Scrape cards from a specific set
 */
export const scrapeCardsFromSet = async (setUrl: string): Promise<ScrapedCardData[]> => {
  try {
    const response = await axios.get(setUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const cards: ScrapedCardData[] = [];

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
      } catch (error) {
        console.error('Error parsing card:', error);
      }
    });

    return cards;
  } catch (error) {
    console.error('Error scraping cards:', error);
    return [];
  }
};

/**
 * Save scraped cards to database
 */
export const saveScrappedCards = async (cards: ScrapedCardData[]) => {
  try {
    const savedCards: ICard[] = [];

    for (const cardData of cards) {
      // Check if card already exists
      const exists = await Card.findOne({
        pokemonId: cardData.pokemonId
      });

      if (!exists) {
        const card = new Card({
          ...cardData,
          hpCategory: categorizeCard(cardData.hp)
        });

        await card.save();
        savedCards.push(card);
      }
    }

    return savedCards;
  } catch (error) {
    console.error('Error saving scraped cards:', error);
    throw error;
  }
};

/**
 * Seed sample Pokemon cards (for development/testing)
 */
export const seedSampleCards = async () => {
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
      const exists = await Card.findOne({ pokemonId: cardData.pokemonId });
      
      if (!exists) {
        const card = new Card({
          ...cardData,
          hpCategory: categorizeCard(cardData.hp)
        });
        await card.save();
        createdCards.push(card);
      }
    }
    
    console.log(`Seeded ${createdCards.length} sample cards`);
    return createdCards;
  } catch (error) {
    console.error('Error seeding cards:', error);
    throw error;
  }
};
