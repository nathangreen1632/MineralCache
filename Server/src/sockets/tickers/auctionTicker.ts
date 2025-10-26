// Server/src/sockets/tickers/auctionTicker.ts
import type { Server } from 'socket.io';
import { roomForAuction, emitAuctionEnded } from '../emitters/auctions.emit.js';
import { db } from '../../models/sequelize.js';
import { endAuctionTx } from '../../services/auction.service.js';

const REGISTRY = new Map<number, NodeJS.Timeout>();
const ENDS = new Map<number, Date>();

export function ensureAuctionTicker(io: Server, auctionId: number, endAt?: Date | null) {
  if (!endAt) return;
  ENDS.set(auctionId, endAt);
  if (REGISTRY.has(auctionId)) return;

  const tick = async () => {
    const end = ENDS.get(auctionId);
    const ms = Math.max(0, (end ? end.getTime() : 0) - Date.now());

    io.to(roomForAuction(auctionId)).emit('auction:tick', { auctionId, msRemaining: ms });

    if (ms <= 0) {
      stopAuctionTicker(auctionId);

      const sequelize = db.instance();
      if (sequelize) {
        try {
          await sequelize.transaction(async (tx) => {
            try {
              await endAuctionTx(tx, Number(auctionId), { kind: 'admin' }, 'natural_end');
            } catch {}
          });
        } catch {}
      }

      emitAuctionEnded(io, auctionId, { reason: 'time' });
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
  ENDS.delete(auctionId);
}
