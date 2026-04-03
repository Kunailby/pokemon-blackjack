import mongoose, { Document } from 'mongoose';
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
declare const _default: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=User.d.ts.map