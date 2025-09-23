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
    console.log('[db] connected');
  } else {
    console.warn(`[db] unavailable: ${result.error ?? 'unknown error'}`);
  }

  server.listen(PORT, () => {
    console.log(`Server listening on → ${URL}`);
  });
})();

/**
 * Graceful shutdown with proper awaits (no nested callbacks).
 * Sonar-friendly: promises are awaited inside the try block.
 */
async function shutdown(signal: NodeJS.Signals) {
  console.log(`[svc] ${signal} received — shutting down…`);
  try {
    // Close Socket.IO
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });

    // Close HTTP server
    await new Promise<void>((resolve, reject) => {
      server.close((err?: Error) => (err ? reject(err) : resolve()));
    });

    console.log('[svc] closed');
    process.exit(0);
  } catch (err) {
    console.error('[svc] shutdown error', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
