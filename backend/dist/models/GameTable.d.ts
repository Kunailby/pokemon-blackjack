import mongoose, { Document } from 'mongoose';
export interface IGameTable extends Document {
    inviteCode: string;
    dealerId: string;
    players: {
        userId: string;
        username: string;
        hand: string[];
        totalHP: number;
        isStanding: boolean;
        chipsBet: number;
    }[];
    dealer: {
        hand: string[];
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
declare const _default: mongoose.Model<IGameTable, {}, {}, {}, mongoose.Document<unknown, {}, IGameTable, {}, {}> & IGameTable & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=GameTable.d.ts.map