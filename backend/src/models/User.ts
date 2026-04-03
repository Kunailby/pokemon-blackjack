import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  passwordHash: string;
  chips: number;
  lastDailyBonus: string;
  personalHof: any;
  dex: any;
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  username:        { type: String, required: true, unique: true },
  passwordHash:    { type: String, default: '' },
  chips:           { type: Number, default: 1000 },
  lastDailyBonus:  { type: String, default: '' },
  personalHof:     Schema.Types.Mixed,
  dex:             Schema.Types.Mixed,
  totalGamesPlayed:{ type: Number, default: 0 },
  totalWins:       { type: Number, default: 0 },
  totalLosses:     { type: Number, default: 0 },
  createdAt:       { type: Date, default: Date.now },
});

export default mongoose.model<IUser>('User', UserSchema);
