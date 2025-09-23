// Server/src/server.ts
import 'dotenv/config';
import { createServer } from 'node:http';
import app from './app.js';
import { db } from './models/sequelize.js';
import { initSockets } from './sockets/index.js';

let PORT = Number(process.env.PORT);
if (!Number.isFinite(PORT) || PORT <= 0) {
  PORT = 4000;
}
const URL = `http://localhost:${PORT}`;

// Create HTTP server (same origin) and initialize Socket.IO via our helper
const server = createServer(app);
// Export if other modules need access to the io instance
export const io = initSockets(server, { path: '/socket.io' });

// DB status log (do not crash app if DB unavailable); always start server
(async () => {
  const result = await db.ping();
  if (result.ok) {
    // eslint-disable-next-line no-console
    console.log('[db] connected');
  } else {
    // eslint-disable-next-line no-console
    console.warn(`[db] unavailable: ${result.error ?? 'unknown error'}`);
  }

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on → ${URL}`);
  });
})();
