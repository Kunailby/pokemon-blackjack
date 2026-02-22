import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  chips: number;
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  chips: { type: Number, default: 1000 },
  totalGamesPlayed: { type: Number, default: 0 },
  totalWins: { type: Number, default: 0 },
  totalLosses: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IUser>('User', UserSchema);
