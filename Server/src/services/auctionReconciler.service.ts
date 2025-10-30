// Server/src/services/auction.reconciler.ts
import type { Server } from 'socket.io';
import { Op } from 'sequelize';
import { db } from '../models/sequelize.js';
import { Auction } from '../models/auction.model.js';
import { endAuctionTx } from './auction.service.js';
import { ensureAuctionTicker } from '../sockets/tickers/auctionTicker.js';
import { emitAuctionEnded } from '../sockets/emitters/auctions.emit.js';

export async function reconcileAuctions(io: Server) {
  const s = db.instance();
  if (!s) return;
  const now = new Date();

  const overdue = await Auction.findAll({
    where: { status: 'live', endAt: { [Op.lte]: now } },
    attributes: ['id'],
  });

  for (const a of overdue) {
    try {
      await s.transaction(async (tx) => {
        await endAuctionTx(tx, Number(a.id), { kind: 'admin' }, 'natural_end');
      });
      emitAuctionEnded(io, Number(a.id), { reason: 'time' });
    } catch {}
  }

  const upcoming = await Auction.findAll({
    where: { status: 'live', endAt: { [Op.gt]: now } },
    attributes: ['id', 'endAt'],
  });

  for (const a of upcoming) {
    const endAt = a.endAt ? new Date(a.endAt) : null;
    ensureAuctionTicker(io, Number(a.id), endAt ?? null);
  }
}
