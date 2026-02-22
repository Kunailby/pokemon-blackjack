import mongoose, { Schema, Document } from 'mongoose';

export interface IGameTable extends Document {
  inviteCode: string;
  dealerId: string;
  players: {
    userId: string;
    username: string;
    hand: string[]; // Card IDs
    totalHP: number;
    isStanding: boolean;
    chipsBet: number;
  }[];
  dealer: {
    hand: string[]; // Card IDs
    totalHP: number;
    isStanding: boolean;
  };
  maxPlayers: number;
  shoeId: string;
  gameStatus: 'waiting' | 'in-progress' | 'finished';
  winner?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GameTableSchema = new Schema<IGameTable>({
  inviteCode: { type: String, required: true, unique: true },
  dealerId: { type: String, required: true },
  players: [{
    userId: String,
    username: String,
    hand: [{ type: String }],
    totalHP: Number,
    isStanding: Boolean,
    chipsBet: Number
  }],
  dealer: {
    hand: [{ type: String }],
    totalHP: Number,
    isStanding: Boolean
  },
  maxPlayers: { type: Number, default: 6 },
  shoeId: { type: String },
  gameStatus: {
    type: String,
    enum: ['waiting', 'in-progress', 'finished'],
    default: 'waiting'
  },
  winner: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model<IGameTable>('GameTable', GameTableSchema);
