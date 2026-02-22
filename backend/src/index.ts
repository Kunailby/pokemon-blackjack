import express from 'express';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import http from 'http';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import gameRoutes from './routes/gameRoutes';
import cardRoutes from './routes/cardRoutes';
import playRoutes from './routes/playRoutes';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(express.json());

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemon-blackjack');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

connectDB();

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/play', playRoutes);

// Socket.io Events
interface PlayerGameState {
  tableId: string;
  userId: string;
}

const playerGames = new Map<string, PlayerGameState>();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join-game', (data: { tableId: string; userId: string }) => {
    console.log('Player joined:', data);
    playerGames.set(socket.id, data);
    socket.join(`table-${data.tableId}`);
    io.to(`table-${data.tableId}`).emit('player-joined', { userId: data.userId });
  });

  socket.on('player-hit', (data: { tableId: string; userId: string }) => {
    io.to(`table-${data.tableId}`).emit('player-hit', data);
  });

  socket.on('player-stand', (data: { tableId: string; userId: string }) => {
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
