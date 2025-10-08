// Server/src/controllers/auctions.controller.ts
import type { Request, Response } from 'express';
import type { Server as IOServer } from 'socket.io';
import { z } from 'zod';
import type { Transaction } from 'sequelize';

import { db } from '../models/sequelize.js';
import { Auction } from '../models/auction.model.js';
import { Product } from '../models/product.model.js';

import { placeBidTx, minimumAcceptableBid } from '../services/auction.service.js';
import { bidBodySchema, bidParamsSchema } from '../validation/auctions.schema.js';

import { emitHighBid, emitOutbid, emitAuctionEnded } from '../sockets/emitters/auctions.emit.js';
import { ensureAuctionTicker } from '../sockets/tickers/auctionTicker.js';
import { obs } from '../services/observability.service.js';

/** ------------------------------------------------------------------------
 * Helpers (auth + age gate)
 * -----------------------------------------------------------------------*/
function ensureAuthed(req: Request, res: Response): req is Request & {
  user: { id: number; role: 'buyer' | 'vendor' | 'admin'; dobVerified18: boolean; vendorId?: number | null };
} {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  (req as any).user = u;
  return true;
}

function ensureAdult(req: Request, res: Response): boolean {
  const u = (req.session as any)?.user;
  if (!u?.dobVerified18) {
    res.status(403).json({ error: 'Age verification required' });
    return false;
  }
  return true;
}

function getIO(req: Request): IOServer | null {
  const io = req.app.get('io') as IOServer | undefined;
  return io ?? null;
}

function parsePositiveInt(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}

/** ------------------------------------------------------------------------
 * Public reads
 * -----------------------------------------------------------------------*/
export async function listAuctions(req: Request, res: Response): Promise<void> {
  // If DB isn’t configured or reachable in dev, return an empty list
  const sequelize = db.instance();
  if (!sequelize) {
    res.json({ items: [], total: 0 });
    return;
  }
  const ping = await db.ping();
  if (!ping.ok) {
    (obs as any)?.info?.('auctions.list.db_unavailable', { error: ping.error });
    res.json({ items: [], total: 0 });
    return;
  }

  try {
    // Build a safe options object
    const where: Record<string, unknown> = {};

    // Optional status filter (?status=live|scheduled|ended|canceled|draft)
    const qStatus = typeof req.query?.status === 'string' ? req.query.status.trim().toLowerCase() : '';
    if (qStatus.length > 0) {
      where.status = qStatus;
    }

    // Optional limit (?limit=N) with cap
    const rawLimit = typeof req.query?.limit !== 'undefined' ? String(req.query.limit) : '';
    const parsedLimit = Number.parseInt(rawLimit, 10);
    let limit = 24;
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
      limit = Math.min(parsedLimit, 100);
    }

    const items = await Auction.findAll({
      where,
      order: [
        ['endAt', 'ASC'],
        ['id', 'ASC'],
      ],
      limit,
    });

    res.json({ items, total: items.length });
  } catch (err: unknown) {
    obs.error(req, 'auctions.list.error', err);
    res.status(500).json({
      ok: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to list auctions',
    });
  }
}

export async function getAuction(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt((req.params as any)?.id);
  if (id == null) {
    res.status(400).json({ error: 'Invalid auction id' });
    return;
  }
  const a = await Auction.findByPk(id);
  if (!a) {
    res.status(404).json({ error: 'Auction not found' });
    return;
  }
  res.json({ data: a });
}

/** ------------------------------------------------------------------------
 * Vendor create (auth required; age gate not required for creating)
 * -----------------------------------------------------------------------*/
export async function createAuction(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;
  if (req.user?.role !== 'vendor' && req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // TODO: validate payload with zod; persist; schedule open/close jobs
  res.status(201).json({ id: null });
}

/** ------------------------------------------------------------------------
 * Bidding (auth + 18+ required) — DB-backed with proxy-bid MVP
 * -----------------------------------------------------------------------*/
export async function placeBid(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;
  if (!ensureAdult(req, res)) return;

  // Validate params/body with Zod
  const pz = bidParamsSchema.safeParse(req.params);
  if (!pz.success) {
    res.status(400).json({ error: 'Invalid params', details: (z as any).treeifyError?.(pz.error) ?? pz.error });
    return;
  }
  const bz = bidBodySchema.safeParse(req.body);
  if (!bz.success) {
    res.status(400).json({ error: 'Invalid body', details: (z as any).treeifyError?.(bz.error) ?? bz.error });
    return;
  }

  const auctionId = pz.data.id;
  const amountCents = Math.max(0, Math.trunc(bz.data.amountCents));
  const maxProxyCents =
    typeof bz.data.maxProxyCents === 'number'
      ? Math.max(0, Math.trunc(bz.data.maxProxyCents))
      : null;

  const sequelize = db.instance();
  if (!sequelize) {
    res.status(503).json({ error: 'Database unavailable' });
    return;
  }

  try {
    const result = await sequelize.transaction(async (tx: Transaction) => {
      // Lock auction row
      const a = await Auction.findByPk(auctionId, { transaction: tx, lock: true });
      if (!a) return { ok: false as const, error: 'Auction not found' };

      const now = new Date();
      if (a.status !== 'live') return { ok: false as const, error: 'Auction is not live' };
      if (a.endAt && now >= new Date(a.endAt)) return { ok: false as const, error: 'Auction has ended' };

      // Guard: vendors cannot bid on their own item
      const product = await Product.findByPk(a.productId, { transaction: tx });
      const vendorId = typeof (req as any).user?.vendorId === 'number' ? (req as any).user.vendorId : null;
      if (product && vendorId && product.vendorId === vendorId) {
        return { ok: false as const, error: 'Vendors cannot bid on their own items' };
      }

      // Optional UI hint: minimum acceptable check
      const minAcceptable = minimumAcceptableBid(a);
      if (amountCents < minAcceptable) {
        return { ok: false as const, error: `Bid must be at least ${minAcceptable}` };
      }

      // ✅ Correct positional call (tx, auction, userId, amountCents, maxProxyCents)
      const userId = Number((req as any).user.id);
      return placeBidTx(tx, a, userId, amountCents, maxProxyCents);
    });

    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    // Socket: high-bid + outbid + ensure ticker
    const io = getIO(req);
    if (io) {
      const fresh = await Auction.findByPk(auctionId);
      ensureAuctionTicker(io, auctionId, fresh?.endAt ?? null);

      emitHighBid(io, auctionId, {
        highBidCents: result.highBidCents ?? 0,
        leaderUserId: result.leaderUserId ?? 0,
        minNextBidCents: result.minNextBidCents ?? 0,
      });

      if (result.prevLeaderChanged && result.prevLeaderId) {
        emitOutbid(io, auctionId, {
          outbidUserId: result.prevLeaderId,
          highBidCents: result.highBidCents ?? 0,
        });
      }
    }

    (obs as any)?.info?.('auction.bid', {
      requestId: (req as any).context?.requestId,
      userId: (req as any).user?.id,
      auctionId,
      amountCents,
      maxProxyCents,
      leaderUserId: result.leaderUserId,
      highBidCents: result.highBidCents,
    });

    res.json({
      ok: true,
      data: {
        leaderUserId: result.leaderUserId,
        highBidCents: result.highBidCents,
        youAreLeading: result.youAreLeading,
        minNextBidCents: result.minNextBidCents,
      },
    });
  } catch (err: unknown) {
    obs.error(req, 'auction.bid.error', err);
    res.status(500).json({ error: 'Failed to place bid' });
  }
}

/** ------------------------------------------------------------------------
 * Buy It Now (auth + 18+ required)
 * Emits an "ended" event to the room.
 * -----------------------------------------------------------------------*/
export async function buyNow(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;
  if (!ensureAdult(req, res)) return;

  const auctionId = parsePositiveInt((req.params as any)?.id);
  if (auctionId == null) {
    res.status(400).json({ error: 'Invalid auctionId' });
    return;
  }

  // TODO: validate; lock auction; create reserved checkout; persist
  const io = getIO(req);
  if (io) {
    emitAuctionEnded(io, auctionId, { reason: 'buy-now' });
  }

  res.status(202).json({ ok: true });
}

