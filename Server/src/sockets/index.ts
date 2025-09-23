// Server/src/sockets/index.ts
import type { Server as HttpServer } from 'node:http'; // ← consistent with server.ts
import { Server } from 'socket.io';
import { registerAuctionSocketHandlers } from './modules/auctions.socket.js';

type InitOpts = { path?: string };

export function initSockets(httpServer: HttpServer, opts: InitOpts = {}) {
  const socketPath = opts.path ?? '/socket.io'; // no nested ternaries elsewhere

  const io = new Server(httpServer, {
    path: socketPath,
    serveClient: false,
    // no CORS — same origin
  });

  io.on('connection', (socket) => {
    console.log(`[ws] connected ${socket.id}`);

    registerAuctionSocketHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`[ws] disconnected ${socket.id} (${reason})`);
    });
  });

  console.log(`[ws] Socket.IO initialized (path=${socketPath})`);
  return io;
}
