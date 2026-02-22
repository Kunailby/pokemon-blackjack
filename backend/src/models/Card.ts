import mongoose, { Schema, Document } from 'mongoose';

export interface ICard extends Document {
  name: string;
  hp: number;
  imageUrl: string;
  pokemonId: string;
  setName: string;
  cardNumber: string;
  hpCategory: 'low' | 'medium-low' | 'medium' | 'medium-high' | 'high';
}

const CardSchema = new Schema<ICard>({
  name: { type: String, required: true },
  hp: { type: Number, required: true },
  imageUrl: { type: String, required: true },
  pokemonId: { type: String, required: true },
  setName: { type: String, required: true },
  cardNumber: { type: String, required: true },
  hpCategory: {
    type: String,
    enum: ['low', 'medium-low', 'medium', 'medium-high', 'high'],
    required: true
  }
}, { timestamps: true });

export default mongoose.model<ICard>('Card', CardSchema);
