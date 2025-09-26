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

/** ✅ Additional scaffold emitters (room-aware), matching existing style */

// Leading bid update (distinct from generic "new-bid", useful for UI focus)
export function emitAuctionLeadingBid(io: Server, auctionId: number | string, payload: {
  amountCents: number;
  userId: number | null;
  ts?: number;
}) {
  const rn = auctionRoomName(auctionId);
  const ts = payload.ts ?? Date.now();
  io.to(rn).emit('auction:leading-bid', { auctionId, ...payload, ts });
}

// Notify previous leader they’ve been outbid
export function emitAuctionOutbid(io: Server, auctionId: number | string, payload: {
  previousUserId: number | null;
  amountCents: number;
  ts?: number;
}) {
  const rn = auctionRoomName(auctionId);
  const ts = payload.ts ?? Date.now();
  io.to(rn).emit('auction:outbid', { auctionId, ...payload, ts });
}

// Presence (optional): user joined the auction room
export function emitAuctionUserJoined(io: Server, auctionId: number | string, userId: number | null, ts?: number) {
  const rn = auctionRoomName(auctionId);
  io.to(rn).emit('auction:user-joined', { auctionId, userId, ts: ts ?? Date.now() });
}

// Presence (optional): user left the auction room
export function emitAuctionUserLeft(io: Server, auctionId: number | string, userId: number | null, ts?: number) {
  const rn = auctionRoomName(auctionId);
  io.to(rn).emit('auction:user-left', { auctionId, userId, ts: ts ?? Date.now() });
}
