import express from 'express';
import process from 'node:process';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import './db/init.js';
import authRoutes from './routes/auth.js';
import candidateRoutes from './routes/candidates.js';
import paymentRoutes from './routes/payments.js';
import lessonRoutes from './routes/lessons.js';
import inventoryRoutes from './routes/inventory.js';
import purchaseRoutes from './routes/purchases.js';
import salesRoutes from './routes/sales.js';
import lensosDashboardRoutes from './routes/lensosDashboard.js';
import dashboardRoutes from './routes/dashboard.js';
import { authenticate, requirePermission } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
});

const rooms = new Map();
let leaderboard = [
  { name: 'Nova', rating: 1840 },
  { name: 'Vector', rating: 1715 },
  { name: 'Pulse', rating: 1660 },
];
const freshInventory = () => ({
  X: { L: 3, M: 3, S: 3 },
  O: { L: 3, M: 3, S: 3 },
});

// Middleware
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'null',
  ...(process.env.LENSOS_CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
]);
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());
app.use((req, _res, next) => { if (req.body === undefined) req.body = {}; next(); });

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'LensOS API is running.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/candidates', authenticate, candidateRoutes);
app.use('/api/quattrodrive/payments', authenticate, paymentRoutes);
app.use('/api/lessons', authenticate, lessonRoutes);
app.use('/api/quattrodrive/dashboard', authenticate, dashboardRoutes);
app.use('/api/inventory', authenticate, inventoryRoutes);
app.use('/api/purchases', authenticate, requirePermission('purchases:read'), purchaseRoutes);
app.use('/api/sales', authenticate, requirePermission('sales:read'), salesRoutes);
app.use('/api/dashboard', authenticate, requirePermission('dashboard:read'), lensosDashboardRoutes);

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('Unhandled API error:', error.message);
  res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
});

io.on('connection', (socket) => {
  socket.emit('leaderboard', leaderboard);

  socket.on('join-room', (roomCode) => {
    const code = String(roomCode || '').trim().toUpperCase();
    if (!code) return;
    socket.join(code);

    if (!rooms.has(code)) {
      rooms.set(code, {
        board: Array.from({ length: 9 }, () => ({})),
        inventory: freshInventory(),
        turn: 'X',
        history: [],
        players: [],
      });
    }

    const room = rooms.get(code);
    if (!room.players.includes(socket.id) && room.players.length < 2) {
      room.players.push(socket.id);
    }

    io.to(code).emit('room-state', {
      board: room.board,
      inventory: room.inventory,
      turn: room.turn,
      history: room.history,
      playerCount: room.players.length,
    });
  });

  socket.on('game-move', ({ roomCode, move }) => {
    const code = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room || !move) return;

    const nextBoard = room.board.map((cell) => ({ ...cell }));
    let acceptedMove = false;
    if (!nextBoard[move.to]?.[move.size] && room.inventory[move.player]?.[move.size] > 0) {
      nextBoard[move.to] = { ...nextBoard[move.to], [move.size]: move.player };
      room.inventory[move.player][move.size] = Math.max(0, room.inventory[move.player][move.size] - 1);
      acceptedMove = true;
    }
    if (!acceptedMove) return;

    room.board = nextBoard;
    room.turn = move.player === 'X' ? 'O' : 'X';
    room.history.push(move);
    io.to(code).emit('room-state', {
      board: room.board,
      inventory: room.inventory,
      turn: room.turn,
      history: room.history,
      playerCount: room.players.length,
    });
  });

  socket.on('report-result', ({ name, ratingDelta = 8 }) => {
    const playerName = String(name || 'Guest').slice(0, 18);
    const entry = leaderboard.find((item) => item.name === playerName);
    if (entry) {
      entry.rating += Number(ratingDelta) || 0;
    } else {
      leaderboard.push({ name: playerName, rating: 1500 + (Number(ratingDelta) || 0) });
    }
    leaderboard = leaderboard.sort((a, b) => b.rating - a.rating).slice(0, 10);
    io.emit('leaderboard', leaderboard);
  });

  socket.on('disconnect', () => {
    for (const room of rooms.values()) {
      room.players = room.players.filter((playerId) => playerId !== socket.id);
    }
  });
});

// Start internal server only if not testing
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`Express server is listening on port ${PORT}`);
  });
}

export default app;
