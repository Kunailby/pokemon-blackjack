import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as {
      userId: string;
      username: string;
    };

    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const generateToken = (userId: string, username: string): string => {
  return jwt.sign({ userId, username }, process.env.JWT_SECRET || 'default-secret', {
    expiresIn: '24h'
  });
};
