import { Response } from 'express';
import User from '../models/User';
import { AuthRequest, generateToken } from '../middleware/auth';

export const login = async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }
    let user = await User.findOne({ username });
    if (!user) {
      // Auto-create user if not exists
      user = new User({ username, chips: 1000 });
      await user.save();
    }
    const token = generateToken(user._id.toString(), user.username);
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        chips: user.chips,
        totalGamesPlayed: user.totalGamesPlayed,
        totalWins: user.totalWins,
        totalLosses: user.totalLosses
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        chips: user.chips,
        totalGamesPlayed: user.totalGamesPlayed,
        totalWins: user.totalWins,
        totalLosses: user.totalLosses
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};
