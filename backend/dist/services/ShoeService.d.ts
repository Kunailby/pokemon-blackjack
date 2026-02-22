import { ICard } from '../models/Card';
/**
 * Generate a unique invite code
 */
export declare const generateInviteCode: () => string;
/**
 * Create a new shoe with 208 random cards
 */
export declare const createShoe: (gameId: string) => Promise<import("mongoose").Document<unknown, {}, import("../models/Shoe").IShoe, {}, {}> & import("../models/Shoe").IShoe & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}>;
/**
 * Draw a card from the shoe
 */
export declare const drawCard: (shoeId: string) => Promise<ICard>;
//# sourceMappingURL=ShoeService.d.ts.map