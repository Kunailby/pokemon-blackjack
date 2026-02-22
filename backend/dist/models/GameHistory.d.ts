import mongoose, { Document } from 'mongoose';
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
declare const _default: mongoose.Model<IGameHistory, {}, {}, {}, mongoose.Document<unknown, {}, IGameHistory, {}, {}> & IGameHistory & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=GameHistory.d.ts.map