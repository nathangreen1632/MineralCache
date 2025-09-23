// Server/src/sockets/modules/auctions.socket.ts
import type { Server, Socket } from 'socket.io';
import { auctionRoomName } from '../../utils/rooms.util.js';

type JoinPayload = { auctionId: number | string };
type LeavePayload = { auctionId: number | string };

export function registerAuctionSocketHandlers(io: Server, socket: Socket) {
  socket.on('auction:join', async (payload: JoinPayload, ack?: (res: any) => void) => {
    try {
      const rn = auctionRoomName(payload?.auctionId);
      await socket.join(rn);

      const count = (await io.in(rn).fetchSockets()).length;

      socket.to(rn).emit('auction:user-joined', {
        auctionId: payload.auctionId,
        socketId: socket.id,
        count,
      });

      if (ack) ack({ ok: true, room: rn, count });
    } catch (e: any) {
      if (ack) ack({ ok: false, error: e?.message || 'join-failed' });
    }
  });

  socket.on('auction:leave', async (payload: LeavePayload, ack?: (res: any) => void) => {
    try {
      const rn = auctionRoomName(payload?.auctionId);
      await socket.leave(rn);

      const count = (await io.in(rn).fetchSockets()).length;

      socket.to(rn).emit('auction:user-left', {
        auctionId: payload.auctionId,
        socketId: socket.id,
        count,
      });

      if (ack) ack({ ok: true, room: rn, count });
    } catch (e: any) {
      if (ack) ack({ ok: false, error: e?.message || 'leave-failed' });
    }
  });

  socket.on('auction:ping', (payload: { auctionId: number | string }, ack?: (res: any) => void) => {
    const rn = auctionRoomName(payload?.auctionId);
    io.to(rn).emit('auction:pong', { ts: Date.now() });
    if (ack) ack({ ok: true });
  });

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
