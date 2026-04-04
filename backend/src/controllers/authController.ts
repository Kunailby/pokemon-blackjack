import { Response } from 'express';
import User from '../models/User';
import GlobalHoF from '../models/GlobalHoF';
import { AuthRequest, generateToken } from '../middleware/auth';

export const login = async (req: AuthRequest, res: Response) => {
  try {
    const { username, passwordHash } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    let user = await User.findOne({ username });
    let isNew = false;

    if (!user) {
      user = new User({ username, passwordHash: passwordHash || '', chips: 1000, lastDailyBonus: '' });
      await user.save();
      isNew = true;
    } else {
      // Verify password if one is stored
      if (user.passwordHash && user.passwordHash !== (passwordHash || '')) {
        return res.status(401).json({ error: 'Incorrect password.' });
      }
      // Migrate: store passwordHash on first login with new client
      if (!user.passwordHash && passwordHash) {
        user.passwordHash = passwordHash;
        await user.save();
      }
    }

    const token = generateToken(user._id.toString(), user.username);
    res.json({
      token,
      isNew,
      user: {
        chips:           user.chips,
        lastDailyBonus:  user.lastDailyBonus || '',
        personalHof:     user.personalHof    || [],
        dex:             user.dex            || [],
      },
    });
  } catch (error: any) {
    console.error('Login error:', error?.message, error?.stack);
    res.status(500).json({ error: 'Login failed: ' + (error?.message || 'unknown') });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      user: {
        username:       user.username,
        chips:          user.chips,
        lastDailyBonus: user.lastDailyBonus || '',
        personalHof:    user.personalHof    || [],
        dex:            user.dex            || [],
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

export const syncGameData = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });
    const { chips, lastDailyBonus, personalHof, dex } = req.body;
    await User.findByIdAndUpdate(req.userId, { chips, lastDailyBonus, personalHof, dex });
    res.json({ ok: true });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
};

export const getGlobalHoF = async (_req: AuthRequest, res: Response) => {
  try {
    const doc = await GlobalHoF.findOne();
    res.json({ entries: doc?.entries || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch HoF' });
  }
};

export const addToGlobalHoF = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });
    const { entry } = req.body;
    const doc = await GlobalHoF.findOne();
    const current = (doc?.entries || []) as any[];
    const updated = [...current, entry].sort((a, b) => b.bet - a.bet).slice(0, 10);
    await GlobalHoF.findOneAndUpdate({}, { entries: updated }, { upsert: true });
    res.json({ entries: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update HoF' });
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });
    await User.findByIdAndDelete(req.userId);
    res.status(204).send();
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
