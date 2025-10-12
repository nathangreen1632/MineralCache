// Server/src/sockets/tickers/auctionTicker.ts
import type { Server } from 'socket.io';
import { roomForAuction } from '../emitters/auctions.emit.js';

// Timer handles by auctionId
const REGISTRY = new Map<number, NodeJS.Timeout>();
// Live end times by auctionId (so we can update endAt while the ticker is running)
const ENDS = new Map<number, Date>();

export function ensureAuctionTicker(io: Server, auctionId: number, endAt?: Date | null) {
  if (!endAt) return;

  // Always refresh the stored end time so anti-sniping extensions (later calls) take effect
  ENDS.set(auctionId, endAt);

  // If already ticking, just updated endAt above is enough
  if (REGISTRY.has(auctionId)) return;

  const tick = () => {
    const now = Date.now();
    const end = ENDS.get(auctionId);
    const ms = Math.max(0, (end ? end.getTime() : 0) - now);

    io.to(roomForAuction(auctionId)).emit('auction:tick', { auctionId, msRemaining: ms });

    if (ms <= 0) {
      const t = REGISTRY.get(auctionId);
      if (t) clearInterval(t);
      REGISTRY.delete(auctionId);
      ENDS.delete(auctionId);
    }
  };

  // Fire immediately, then every second
  tick();
  const t = setInterval(tick, 1000);
  REGISTRY.set(auctionId, t);
}

export function stopAuctionTicker(auctionId: number) {
  const t = REGISTRY.get(auctionId);
  if (t) clearInterval(t);
  REGISTRY.delete(auctionId);
  ENDS.delete(auctionId);
}
