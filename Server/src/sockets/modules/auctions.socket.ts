// Server/src/sockets/modules/auctions.socket.ts
import type { Server, Socket } from 'socket.io';

type JoinPayload = { auctionId: number | string };
type LeavePayload = { auctionId: number | string };

function roomName(id: number | string): string {
  const n = Number(id);
  const isPositiveNumber = Number.isFinite(n) && n > 0;

  let key = String(id).trim();
  if (isPositiveNumber) {
    key = String(n);
  }

  return `auction:${key}`;
}

export function registerAuctionSocketHandlers(io: Server, socket: Socket) {
  // Join an auction room
  socket.on('auction:join', async (payload: JoinPayload, ack?: (res: any) => void) => {
    try {
      const rn = roomName(payload?.auctionId);
      await socket.join(rn);

      // Presence count (lightweight)
      const count = (await io.in(rn).fetchSockets()).length;

      socket.to(rn).emit('auction:user-joined', {
        auctionId: payload.auctionId,
        socketId: socket.id,
        count,
      });

      ack?.({ ok: true, room: rn, count });
    } catch (e: any) {
      ack?.({ ok: false, error: e?.message || 'join-failed' });
    }
  });

  // Leave an auction room
  socket.on('auction:leave', async (payload: LeavePayload, ack?: (res: any) => void) => {
    try {
      const rn = roomName(payload?.auctionId);
      await socket.leave(rn);

      const count = (await io.in(rn).fetchSockets()).length;

      socket.to(rn).emit('auction:user-left', {
        auctionId: payload.auctionId,
        socketId: socket.id,
        count,
      });

      ack?.({ ok: true, room: rn, count });
    } catch (e: any) {
      ack?.({ ok: false, error: e?.message || 'leave-failed' });
    }
  });

  // Placeholder emits — no business logic, just a stub broadcast API
  socket.on('auction:ping', (payload: { auctionId: number | string }, ack?: (res: any) => void) => {
    const rn = roomName(payload?.auctionId);
    io.to(rn).emit('auction:pong', { ts: Date.now() });
    ack?.({ ok: true });
  });

  // When a client disconnects, notify any auction rooms it was in
  socket.on('disconnecting', () => {
    const rooms = Array.from(socket.rooms).filter((r) => r.startsWith('auction:'));
    rooms.forEach((rn) => {
      socket.to(rn).emit('auction:user-left', {
        auctionId: rn.split(':')[1],
        socketId: socket.id,
      });
    });
  });
}
