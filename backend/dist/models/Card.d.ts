import mongoose, { Document } from 'mongoose';
export interface ICard extends Document {
    name: string;
    hp: number;
    imageUrl: string;
    pokemonId: string;
    setName: string;
    cardNumber: string;
    hpCategory: 'low' | 'medium-low' | 'medium' | 'medium-high' | 'high';
}
declare const _default: mongoose.Model<ICard, {}, {}, {}, mongoose.Document<unknown, {}, ICard, {}, {}> & ICard & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=Card.d.ts.map