// Server/src/sockets/emitters/auctions.emit.ts
import type { Server } from 'socket.io';
import { auctionRoomName } from '../../utils/rooms.util.js';

export function emitAuctionNewBid(io: Server, auctionId: number | string, payload: {
  amountCents: number;
  userId: number;
  ts?: number;
}) {
  const rn = auctionRoomName(auctionId);
  const ts = payload.ts ?? Date.now();
  io.to(rn).emit('auction:new-bid', { ...payload, ts });
}

export function emitAuctionEnded(io: Server, auctionId: number | string, payload?: { reason?: string }) {
  const rn = auctionRoomName(auctionId);
  io.to(rn).emit('auction:ended', { auctionId, reason: payload?.reason ?? null });
}
