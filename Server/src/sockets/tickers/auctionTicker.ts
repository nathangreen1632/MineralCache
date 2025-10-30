// Server/src/sockets/tickers/auctionTicker.ts
import type { Server } from 'socket.io';
import { roomForAuction, emitAuctionEnded } from '../emitters/auctions.emit.js';
import { db } from '../../models/sequelize.js';
import { endAuctionTx } from '../../services/auction.service.js';

const REGISTRY = new Map<number, NodeJS.Timeout>();
const ENDS = new Map<number, Date>();

function broadcastTick(io: Server, auctionId: number) {
  const end = ENDS.get(auctionId);
  const ms = Math.max(0, (end ? end.getTime() : 0) - Date.now());
  io.to(roomForAuction(auctionId)).emit('auction:tick', { auctionId, msRemaining: ms });
  return ms;
}

async function finalizeIfDue(io: Server, auctionId: number) {
  const end = ENDS.get(auctionId);
  if (!end) return;
  if (Date.now() < end.getTime()) return;
  const s = db.instance();
  if (!s) return;
  try {
    await s.transaction(async (tx) => {
      await endAuctionTx(tx, auctionId, { kind: 'admin' }, 'natural_end');
    });
    emitAuctionEnded(io, auctionId, { reason: 'time' });
  } catch {}
  const t = REGISTRY.get(auctionId);
  if (t) clearInterval(t);
  REGISTRY.delete(auctionId);
  ENDS.delete(auctionId);
}

export function ensureAuctionTicker(io: Server, auctionId: number, endAt?: Date | null) {
  if (!endAt) return;
  ENDS.set(auctionId, endAt);
  if (REGISTRY.has(auctionId)) return;
  const tick = () => {
    const ms = broadcastTick(io, auctionId);
    if (ms === 0) void finalizeIfDue(io, auctionId);
  };
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
