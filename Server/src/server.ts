// Server/src/server.ts
import 'dotenv/config';
import { createServer } from 'node:http';
import app from './app.js';
import { db } from './models/sequelize.js';
import { initSockets } from './sockets/index.js';
import { reconcileAuctions } from './services/auctionReconciler.service.js';

let PORT = Number(process.env.PORT);
if (!Number.isFinite(PORT) || PORT <= 0) {
  PORT = 4000;
}
const URL = `http://localhost:${PORT}`;

const server = createServer(app);
export const io = initSockets(server, { path: '/socket.io' });
app.set('io', io);

(async () => {
  const result = await db.ping();
  if (result.ok) {
    console.log('[db] connected');
    try {
      await reconcileAuctions(io);
    } catch {}
  } else {
    console.warn(`[db] unavailable: ${result.error ?? 'unknown error'}`);
  }

  server.listen(PORT, () => {
    console.log(`Server listening on → ${URL}`);
  });
})();

async function shutdown(signal: NodeJS.Signals) {
  console.log(`[svc] ${signal} received — shutting down…`);
  try {
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
    await new Promise<void>((resolve, reject) => {
      server.close((err?: Error) => (err ? reject(err) : resolve()));
    });
    const s = db.instance();
    if (s) await s.close();
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
