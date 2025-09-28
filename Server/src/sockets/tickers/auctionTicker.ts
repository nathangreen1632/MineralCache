import type { Server } from 'socket.io';
import { roomForAuction } from '../emitters/auctions.emit.js';

const REGISTRY = new Map<number, NodeJS.Timeout>();

export function ensureAuctionTicker(io: Server, auctionId: number, endAt?: Date | null) {
  if (!endAt) return;
  if (REGISTRY.has(auctionId)) return;

  const tick = () => {
    const now = Date.now();
    const ms = Math.max(0, endAt.getTime() - now);
    io.to(roomForAuction(auctionId)).emit('auction:tick', { auctionId, msRemaining: ms });

    if (ms <= 0) {
      const t = REGISTRY.get(auctionId);
      if (t) clearInterval(t);
      REGISTRY.delete(auctionId);
    }
  };

  tick();
  const t = setInterval(tick, 1000);
  REGISTRY.set(auctionId, t);
}

export function stopAuctionTicker(auctionId: number) {
  const t = REGISTRY.get(auctionId);
  if (t) clearInterval(t);
  REGISTRY.delete(auctionId);
}
