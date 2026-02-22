import mongoose, { Document } from 'mongoose';
export interface IUser extends Document {
    username: string;
    email: string;
    password: string;
    chips: number;
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