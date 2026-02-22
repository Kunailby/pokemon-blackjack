import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const createGameTable: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const joinGameTable: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getGameTable: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const listAvailableGames: (req: AuthRequest, res: Response) => Promise<void>;
export declare const startGame: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=gameController.d.ts.map