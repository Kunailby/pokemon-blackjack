import mongoose, { Schema, Document } from 'mongoose';

export interface IGameHistory extends Document {
  gameTableId: string;
  playerId: string;
  playerUsername: string;
  initialHP: number;
  finalHP: number;
  result: 'win' | 'loss' | 'push';
  chipsBet: number;
  chipsWon: number;
  createdAt: Date;
}

const GameHistorySchema = new Schema<IGameHistory>({
  gameTableId: { type: String, required: true },
  playerId: { type: String, required: true },
  playerUsername: { type: String, required: true },
  initialHP: { type: Number, required: true },
  finalHP: { type: Number, required: true },
  result: {
    type: String,
    enum: ['win', 'loss', 'push'],
    required: true
  },
  chipsBet: { type: Number, required: true },
  chipsWon: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IGameHistory>('GameHistory', GameHistorySchema);
