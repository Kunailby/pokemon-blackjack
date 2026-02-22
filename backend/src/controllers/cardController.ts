import { Response } from 'express';
import Card from '../models/Card';
import { AuthRequest } from '../middleware/auth';
import { seedSampleCards } from '../services/CardScraper';

export const listAllCards = async (req: AuthRequest, res: Response) => {
  try {
    const cards = await Card.find().limit(50);
    res.json({
      count: cards.length,
      cards
    });
  } catch (error) {
    console.error('List cards error:', error);
    res.status(500).json({ error: 'Failed to list cards' });
  }
};

export const seedCards = async (req: AuthRequest, res: Response) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Cannot seed in production' });
    }

    const cards = await seedSampleCards();
    res.json({
      message: `Seeded ${cards.length} cards`,
      cards
    });
  } catch (error) {
    console.error('Seed cards error:', error);
    res.status(500).json({ error: 'Failed to seed cards' });
  }
};

export const getCardStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await Card.collection.aggregate([
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
  } catch (error) {
    console.error('Card stats error:', error);
    res.status(500).json({ error: 'Failed to get card stats' });
  }
};
