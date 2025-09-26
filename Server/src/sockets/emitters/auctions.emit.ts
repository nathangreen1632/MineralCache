// Server/src/sockets/emitters/auctions.emit.ts
import type { Server } from 'socket.io';
import { auctionRoomName } from '../../utils/rooms.util.js';

/**
 * Generic: a bid was placed (raw event). Your UI may ignore this in favor of
 * the normalized "high-bid" event below.
 */
export function emitAuctionNewBid(
  io: Server,
  auctionId: number | string,
  payload: {
    amountCents: number;
    userId: number;
    ts?: number;
  }
) {
  const rn = auctionRoomName(auctionId);
  const ts = payload.ts ?? Date.now();
  io.to(rn).emit('auction:new-bid', { auctionId, ...payload, ts });
}

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
  return `auction:${id}`;
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

/* =====================================================================================
 * Back-compat scaffold emitters (kept to match existing style/callers)
 * ===================================================================================== */

/**
 * Leading bid update (legacy helper). Prefer emitHighBid() for normalized payload.
 */
export function emitAuctionLeadingBid(
  io: Server,
  auctionId: number | string,
  payload: {
    amountCents: number;
    userId: number | null;
    ts?: number;
  }
) {
  const rn = auctionRoomName(auctionId);
  const ts = payload.ts ?? Date.now();
  io.to(rn).emit('auction:leading-bid', { auctionId, ...payload, ts });
}

/**
 * Outbid (legacy helper). Emits the standardized 'auction:outbid' payload shape.
 * Maps previousUserId -> outbidUserId and amountCents -> highBidCents.
 */
export function emitAuctionOutbid(
  io: Server,
  auctionId: number | string,
  payload: {
    previousUserId: number | null;
    amountCents: number;
    ts?: number;
  }
) {
  const rn = auctionRoomName(auctionId);
  const ts = payload.ts ?? Date.now();
  io.to(rn).emit('auction:outbid', {
    auctionId,
    outbidUserId: payload.previousUserId ?? 0,
    highBidCents: payload.amountCents,
    ts,
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
