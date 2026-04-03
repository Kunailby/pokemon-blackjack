import { Request, Response } from 'express';
export declare const createGameTable: (req: Request, res: Response) => Promise<void>;
export declare const joinGameTable: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getGameTable: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const listAvailableGames: (req: Request, res: Response) => Promise<void>;
export declare const startGame: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=gameController.d.ts.map