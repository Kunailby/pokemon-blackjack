import mongoose, { Document } from 'mongoose';
export interface IShoe extends Document {
    cards: string[];
    gameId: string;
    cardsUsed: number;
    createdAt: Date;
}
declare const _default: mongoose.Model<IShoe, {}, {}, {}, mongoose.Document<unknown, {}, IShoe, {}, {}> & IShoe & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=Shoe.d.ts.map