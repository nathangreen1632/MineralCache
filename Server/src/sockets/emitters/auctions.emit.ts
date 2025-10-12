// Server/src/sockets/emitters/auctions.emit.ts
import type { Server } from 'socket.io';
import { auctionRoomName } from '../../utils/rooms.util.js';

/** Auction ended broadcast (reason optional, e.g. "time" or "canceled"). */
export function emitAuctionEnded(
  io: Server,
  auctionId: number | string,
  payload?: { reason?: string }
) {
  const rn = auctionRoomName(auctionId);
  io.to(rn).emit('auction:ended', { auctionId, reason: payload?.reason ?? null });
}

/* =====================================================================================
 * NEW: Standardized room-aware emitters used by the Auctions MVP
 * ===================================================================================== */
export function roomForAuction(id: number): string {
  // Delegate to the shared util to avoid room-name drift
  return auctionRoomName(id);
}
/**
 * High-bid update: definitive event with the current leader and the minimum next bid.
 * Uses ISO timestamp (string).
 */
export function emitHighBid(
  io: Server,
  auctionId: number | string,
  payload: {
    highBidCents: number;
    leaderUserId: number;
    minNextBidCents: number;
  }
) {
  const rn = auctionRoomName(auctionId);
  io.to(rn).emit('auction:high-bid', {
    auctionId,
    ...payload,
    ts: new Date().toISOString(),
  });
}

/**
 * Outbid notification: informs listeners that a given user has been outbid.
 * Uses ISO timestamp (string).
 */
export function emitOutbid(
  io: Server,
  auctionId: number | string,
  payload: {
    outbidUserId: number;
    highBidCents: number;
  }
) {
  const rn = auctionRoomName(auctionId);
  io.to(rn).emit('auction:outbid', {
    auctionId,
    ...payload,
    ts: new Date().toISOString(),
  });
}

/**
 * Anti-sniping: broadcast when the auction end time is extended.
 * Uses numeric timestamp (ms since epoch) for easy client-side diffing.
 */
export function emitTimeExtended(
  io: Server,
  auctionId: number | string,
  msExtended: number
) {
  const rn = auctionRoomName(auctionId);
  io.to(rn).emit('auction:time-extended', {
    auctionId,
    msExtended,
    ts: Date.now(),
  });
}

/** Presence (optional): user joined the auction room. */
export function emitAuctionUserJoined(
  io: Server,
  auctionId: number | string,
  userId: number | null,
  ts?: number
) {
  const rn = auctionRoomName(auctionId);
  io.to(rn).emit('auction:user-joined', { auctionId, userId, ts: ts ?? Date.now() });
}

/** Presence (optional): user left the auction room. */
export function emitAuctionUserLeft(
  io: Server,
  auctionId: number | string,
  userId: number | null,
  ts?: number
) {
  const rn = auctionRoomName(auctionId);
  io.to(rn).emit('auction:user-left', { auctionId, userId, ts: ts ?? Date.now() });
}
