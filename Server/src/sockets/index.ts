// Server/src/sockets/index.ts
import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { registerAuctionSocketHandlers } from './modules/auctions.socket.js';

type InitOpts = {
  path?: string;
};

export function initSockets(httpServer: HttpServer, opts: InitOpts = {}) {
  // No CORS — same-origin only
  const socketPath = opts.path ?? '/socket.io';

  const io = new Server(httpServer, {
    path: socketPath,
    serveClient: false,
  });

  io.on('connection', (socket) => {
    // eslint-disable-next-line no-console
    console.log(`[ws] connected ${socket.id}`);

    registerAuctionSocketHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      // eslint-disable-next-line no-console
      console.log(`[ws] disconnected ${socket.id} (${reason})`);
    });
  });

  // eslint-disable-next-line no-console
  console.log(`[ws] Socket.IO initialized (path=${socketPath})`);

  return io;
}
