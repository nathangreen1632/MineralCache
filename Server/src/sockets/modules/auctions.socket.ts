// Server/src/sockets/modules/auctions.socket.ts
import type { Server, Socket } from 'socket.io';
import { auctionRoomName } from '../../utils/rooms.util.js';
import { emitAuctionUserJoined, emitAuctionUserLeft } from '../emitters/auctions.emit.js';

type JoinPayload = { auctionId: number | string } | undefined;
type LeavePayload = { auctionId: number | string } | undefined;

function assertAuctionId(p: JoinPayload): number | string | null {
  if (!p) return null;
  const id = (p as any).auctionId;
  if (typeof id === 'number' && Number.isFinite(id) && id > 0) return id;
  if (typeof id === 'string' && id.trim().length > 0) return id.trim();
  return null;
}

function currentUserId(socket: Socket): number | null {
  const v = (socket.handshake?.auth as any)?.userId;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function registerAuctionSocketHandlers(io: Server, socket: Socket) {
  socket.on('auction:join', async (payload: JoinPayload, ack?: (res: any) => void) => {
    const id = assertAuctionId(payload);
    if (id == null) {
      ack?.({ ok: false, error: 'invalid-auctionId' });
      return;
    }

    const rn = auctionRoomName(id);
    try {
      await socket.join(rn);

      const count = (await io.in(rn).fetchSockets()).length;
      const userId = currentUserId(socket);

      // Standardized room-aware emitter
      emitAuctionUserJoined(io, id, userId);

      // Broadcast current room count snapshot
      io.to(rn).emit('auction:room-count', { auctionId: id, count });

      ack?.({ ok: true, room: rn, count });
    } catch (e: any) {
      ack?.({ ok: false, error: e?.message || 'join-failed' });
    }
  });

  socket.on('auction:leave', async (payload: LeavePayload, ack?: (res: any) => void) => {
    const id = assertAuctionId(payload);
    if (id == null) {
      ack?.({ ok: false, error: 'invalid-auctionId' });
      return;
    }

    const rn = auctionRoomName(id);
    try {
      await socket.leave(rn);

      const count = (await io.in(rn).fetchSockets()).length;
      const userId = currentUserId(socket);

      // Standardized room-aware emitter
      emitAuctionUserLeft(io, id, userId);

      // Broadcast current room count snapshot
      io.to(rn).emit('auction:room-count', { auctionId: id, count });

      ack?.({ ok: true, room: rn, count });
    } catch (e: any) {
      ack?.({ ok: false, error: e?.message || 'leave-failed' });
    }
  });

  socket.on('auction:ping', (payload: JoinPayload, ack?: (res: any) => void) => {
    const id = assertAuctionId(payload);
    if (id == null) {
      ack?.({ ok: false, error: 'invalid-auctionId' });
      return;
    }
    const rn = auctionRoomName(id);
    io.to(rn).emit('auction:pong', { ts: Date.now() });
    ack?.({ ok: true });
  });

  socket.on('disconnecting', () => {
    const userId = currentUserId(socket);
    for (const rn of socket.rooms) {
      if (!rn.startsWith('auction:')) continue;
      const id = rn.split(':')[1];
      // Standardized room-aware emitter on disconnect
      emitAuctionUserLeft(io, id, userId);
    }
  });
}
