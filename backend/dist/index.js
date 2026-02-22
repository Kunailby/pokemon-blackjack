"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const socket_io_1 = require("socket.io");
const http_1 = __importDefault(require("http"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const gameRoutes_1 = __importDefault(require("./routes/gameRoutes"));
const cardRoutes_1 = __importDefault(require("./routes/cardRoutes"));
const playRoutes_1 = __importDefault(require("./routes/playRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '*',
        methods: ['GET', 'POST']
    }
});
// Middleware
app.use(express_1.default.json());
// MongoDB Connection
const connectDB = async () => {
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemon-blackjack');
        console.log('MongoDB connected');
    }
    catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
};
connectDB();
// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' });
});
app.use('/api/auth', authRoutes_1.default);
app.use('/api/games', gameRoutes_1.default);
app.use('/api/cards', cardRoutes_1.default);
app.use('/api/play', playRoutes_1.default);
const playerGames = new Map();
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    socket.on('join-game', (data) => {
        console.log('Player joined:', data);
        playerGames.set(socket.id, data);
        socket.join(`table-${data.tableId}`);
        io.to(`table-${data.tableId}`).emit('player-joined', { userId: data.userId });
    });
    socket.on('player-hit', (data) => {
        io.to(`table-${data.tableId}`).emit('player-hit', data);
    });
    socket.on('player-stand', (data) => {
        io.to(`table-${data.tableId}`).emit('player-stand', data);
    });
    socket.on('disconnect', () => {
        const gameState = playerGames.get(socket.id);
        if (gameState) {
            io.to(`table-${gameState.tableId}`).emit('player-left', { userId: gameState.userId });
            playerGames.delete(socket.id);
        }
        console.log('Client disconnected:', socket.id);
    });
});
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map