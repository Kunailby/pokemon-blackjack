import mongoose, { Schema, Document } from 'mongoose';

export interface IShoe extends Document {
  cards: string[]; // Card IDs
  gameId: string;
  cardsUsed: number;
  createdAt: Date;
}

const ShoeSchema = new Schema<IShoe>({
  cards: [{ type: Schema.Types.ObjectId, ref: 'Card' }],
  gameId: { type: String, required: true },
  cardsUsed: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IShoe>('Shoe', ShoeSchema);
