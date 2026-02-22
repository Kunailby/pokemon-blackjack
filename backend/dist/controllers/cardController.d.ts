import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const listAllCards: (req: AuthRequest, res: Response) => Promise<void>;
export declare const seedCards: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getCardStats: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=cardController.d.ts.map