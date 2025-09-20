// Server/src/server.ts
import 'dotenv/config';
import http from 'node:http';
import { Server as IOServer } from 'socket.io';
import app from './app.js';
import { db } from './models/sequelize.js';

const PORT = Number(process.env.PORT || 4000);
const URL = `http://localhost:${PORT}`;

// Create HTTP server and Socket.IO (same origin)
const server = http.createServer(app);
export const io = new IOServer(server, {
  path: '/socket.io',
});

io.on('connection', (socket) => {
  socket.on('join-auction', (id: string) => socket.join(`a:${id}`));
});

// Log DB status but DO NOT crash; always start server
(async () => {
  const result = await db.ping();
  if (result.ok) {
    console.log('[db] connected');
  } else {
    console.warn(`[db] unavailable: ${result.error ?? 'unknown error'}`);
  }

  server.listen(PORT, () => {
    console.log(`Server listening on → ${URL}`);
  });
})();
