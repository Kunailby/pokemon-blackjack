import crypto from 'crypto';
import Card, { ICard } from '../models/Card';
import Shoe from '../models/Shoe';

const SHOE_SIZE = 208; // 208 cards per shoe

/**
 * Generate a unique invite code
 */
export const generateInviteCode = (): string => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

/**
 * Create a new shoe with 208 random cards
 */
export const createShoe = async (gameId: string) => {
  try {
    // Get all cards from database
    const allCards = await Card.find();

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
    const shoe = new Shoe({
      cards: shoeCards,
      gameId: gameId,
      cardsUsed: 0
    });

    await shoe.save();
    return shoe;
  } catch (error) {
    console.error('Error creating shoe:', error);
    throw error;
  }
};

/**
 * Draw a card from the shoe
 */
export const drawCard = async (shoeId: string): Promise<ICard> => {
  try {
    const shoe = await Shoe.findById(shoeId).populate('cards');

    if (!shoe) {
      throw new Error('Shoe not found');
    }

    if (shoe.cardsUsed >= shoe.cards.length) {
      throw new Error('Shoe is empty');
    }

    const card = shoe.cards[shoe.cardsUsed] as unknown as ICard;
    shoe.cardsUsed += 1;
    await shoe.save();

    return card;
  } catch (error) {
    console.error('Error drawing card:', error);
    throw error;
  }
};
