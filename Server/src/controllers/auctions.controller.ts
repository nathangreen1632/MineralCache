// Server/src/controllers/auctions.controller.ts
import type { Request, Response } from 'express';
import type { Server as IOServer } from 'socket.io';
import { z } from 'zod';
import type { Transaction } from 'sequelize';
import { Op } from 'sequelize';
import { subHours } from 'date-fns';

import { db } from '../models/sequelize.js';
import { Auction } from '../models/auction.model.js';
import { Product } from '../models/product.model.js';
import { ProductImage } from '../models/productImage.model.js';
import { Vendor } from '../models/vendor.model.js';
import { AuctionWatchlist } from '../models/auctionWatchlist.model.js';


import { placeBidTx, minimumAcceptableBid, endAuctionTx } from '../services/auction.service.js';
import { bidBodySchema, bidParamsSchema } from '../validation/auctions.schema.js';
import { centsToUsd } from '../utils/money.util.js';

import { emitHighBid, emitOutbid, emitAuctionEnded } from '../sockets/emitters/auctions.emit.js';
import { ensureAuctionTicker } from '../sockets/tickers/auctionTicker.js';
import { obs } from '../services/observability.service.js';
import { User } from '../models/user.model.js';
import { sendBidEmail } from '../services/email.service.js';

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

export async function listAuctions(req: Request, res: Response): Promise<void> {
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
    const where: Record<string, unknown> = {};

    const qStatus = typeof req.query?.status === 'string' ? req.query.status.trim().toLowerCase() : '';
    if (qStatus.length > 0) {
      where.status = qStatus;
    }

    const rawLimit = typeof req.query?.limit !== 'undefined' ? String(req.query.limit) : '';
    const parsedLimit = Number.parseInt(rawLimit, 10);
    let limit = 24;
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
      limit = Math.min(parsedLimit, 100);
    }

    const cutoff = subHours(new Date(), 120); // 5 days
    const endedWindow = {
      [Op.and]: [
        { status: 'ended' },
        { endAt: { [Op.gte]: cutoff } },
      ],
    };
    const notEnded = { status: { [Op.ne]: 'ended' } };

    if (!where.status) {
      (where as any)[Op.or] = [notEnded, endedWindow];
    }

    const UPLOADS_PUBLIC_ROUTE = process.env.UPLOADS_PUBLIC_ROUTE ?? '/uploads';
    function toPublicUrl(rel?: string | null): string | null {
      if (!rel) return null;
      const s = String(rel).replace(/^\/+/, '');
      return `${UPLOADS_PUBLIC_ROUTE}/${encodeURI(s)}`;
    }

    const rows = await Auction.findAll({
      where,
      order: [
        ['endAt', 'ASC'],
        ['id', 'ASC'],
      ],
      limit,
      include: [
        { model: Vendor, as: 'vendor', attributes: ['id', 'slug'] },
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'title'],
          include: [
            {
              model: ProductImage,
              as: 'images',
              attributes: ['id', 'isPrimary', 'sortOrder', 'v320Path', 'v800Path', 'v1600Path', 'origPath'],
              required: false,
              separate: true,
              limit: 1,
              order: [['isPrimary', 'DESC'], ['sortOrder', 'ASC'], ['id', 'ASC']],
            },
          ],
        },
      ],
    });

    const items = rows.map((a: any) => {
      const p = a.product;
      const img = p?.images?.[0] ?? null;
      const imageUrl =
        toPublicUrl(img?.v800Path ?? img?.v320Path ?? img?.v1600Path ?? img?.origPath ?? null);

      return {
        id: Number(a.id),
        title: a.title ?? null,
        status: a.status,
        startAt: a.startAt,
        endAt: a.endAt,
        productId: p ? Number(p.id) : Number(a.productId),
        vendorId: Number(a.vendorId),
        startingBidCents: Number(a.startPriceCents ?? a.startingBidCents ?? 0),
        highBidCents: a.highBidCents != null ? Number(a.highBidCents) : null,
        highBidUserId: a.highBidUserId != null ? Number(a.highBidUserId) : null,
        productTitle: p?.title ?? null,
        imageUrl,
        vendorSlug: a.vendor?.slug ?? null,
      };
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

export async function listWatchedAuctions(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  const sequelize = db.instance();
  if (!sequelize) {
    res.json({ items: [], total: 0 });
    return;
  }
  const ping = await db.ping();
  if (!ping.ok) {
    (obs as any)?.info?.('auctions.watchlist.db_unavailable', { error: ping.error });
    res.json({ items: [], total: 0 });
    return;
  }

  const userId = (req as any).user.id;

  try {
    const watchRows = await AuctionWatchlist.findAll({
      where: { userId },
      attributes: ['auctionId'],
    });

    const ids = watchRows
      .map((r: any) => Number(r.auctionId))
      .filter((id: number) => Number.isFinite(id));

    if (ids.length === 0) {
      res.json({ items: [], total: 0 });
      return;
    }

    const cutoff = subHours(new Date(), 120);
    const endedWindow = {
      [Op.and]: [{ status: 'ended' }, { endAt: { [Op.gte]: cutoff } }],
    };
    const notEnded = { status: { [Op.ne]: 'ended' } };

    const where: Record<string, unknown> = { id: { [Op.in]: ids } };
    (where as any)[Op.or] = [notEnded, endedWindow];

    const UPLOADS_PUBLIC_ROUTE = process.env.UPLOADS_PUBLIC_ROUTE ?? '/uploads';
    function toPublicUrl(rel?: string | null): string | null {
      if (!rel) return null;
      const s = String(rel).replace(/^\/+/, '');
      return `${UPLOADS_PUBLIC_ROUTE}/${encodeURI(s)}`;
    }

    const rows = await Auction.findAll({
      where,
      order: [
        ['endAt', 'ASC'],
        ['id', 'ASC'],
      ],
      include: [
        { model: Vendor, as: 'vendor', attributes: ['id', 'slug'] },
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'title'],
          include: [
            {
              model: ProductImage,
              as: 'images',
              attributes: ['id', 'isPrimary', 'sortOrder', 'v320Path', 'v800Path', 'v1600Path', 'origPath'],
              required: false,
              separate: true,
              limit: 1,
              order: [['isPrimary', 'DESC'], ['sortOrder', 'ASC'], ['id', 'ASC']],
            },
          ],
        },
      ],
    });

    const items = rows.map((a: any) => {
      const p = a.product;
      const img = p?.images?.[0] ?? null;
      const imageUrl =
        toPublicUrl(img?.v800Path ?? img?.v320Path ?? img?.v1600Path ?? img?.origPath ?? null);

      return {
        id: Number(a.id),
        title: a.title ?? null,
        status: a.status,
        startAt: a.startAt,
        endAt: a.endAt,
        productId: p ? Number(p.id) : Number(a.productId),
        vendorId: Number(a.vendorId),
        startingBidCents: Number(a.startPriceCents ?? a.startingBidCents ?? 0),
        highBidCents: a.highBidCents != null ? Number(a.highBidCents) : null,
        highBidUserId: a.highBidUserId != null ? Number(a.highBidUserId) : null,
        productTitle: p?.title ?? null,
        imageUrl,
        vendorSlug: a.vendor?.slug ?? null,
      };
    });

    res.json({ items, total: items.length });
  } catch (err: unknown) {
    obs.error(req, 'auctions.watchlist.error', err);
    res.status(500).json({
      ok: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to load watchlist',
    });
  }
}

export async function getAuction(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt((req.params as any)?.id);
  if (id == null) {
    res.status(400).json({ error: 'Invalid auction id' });
    return;
  }

  const UPLOADS_PUBLIC_ROUTE = process.env.UPLOADS_PUBLIC_ROUTE ?? '/uploads';
  function toPublicUrl(rel?: string | null): string | null {
    if (!rel) return null;
    const s = String(rel).replace(/^\/+/, '');
    return `${UPLOADS_PUBLIC_ROUTE}/${encodeURI(s)}`;
  }

  const a: any = await Auction.findByPk(id, {
    include: [
      {
        model: Vendor,
        as: 'vendor',
        attributes: ['id', 'slug'],
      },
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'title'],
        include: [
          {
            model: ProductImage,
            as: 'images',
            attributes: ['id', 'isPrimary', 'sortOrder', 'v320Path', 'v800Path', 'v1600Path', 'origPath'],
            required: false,
            separate: true,
            limit: 1,
            order: [['isPrimary', 'DESC'], ['sortOrder', 'ASC'], ['id', 'ASC']],
          },
        ],
      },
    ],
  });

  if (!a) {
    res.status(404).json({ error: 'Auction not found' });
    return;
  }

  const p = a.product ?? null;
  const img = p?.images?.[0] ?? null;
  const imageUrl = toPublicUrl(img?.v800Path ?? img?.v320Path ?? img?.v1600Path ?? img?.origPath ?? null);

  const data = {
    id: Number(a.id),
    title: a.title ?? null,
    status: a.status,
    startAt: a.startAt ?? null,
    endAt: a.endAt ?? null,
    productId: a.productId != null ? Number(a.productId) : undefined,
    vendorId: a.vendorId != null ? Number(a.vendorId) : undefined,
    highBidCents: a.highBidCents != null ? Number(a.highBidCents) : null,
    highBidUserId: a.highBidUserId != null ? Number(a.highBidUserId) : null,
    startingBidCents: Number(a.startPriceCents ?? a.startingBidCents ?? 0),
    reserveCents: a.reservePriceCents != null ? Number(a.reservePriceCents) : null,
    buyNowCents: a.buyNowPriceCents != null ? Number(a.buyNowPriceCents) : null,
    vendorSlug: a.vendor?.slug ?? null,
    productTitle: p?.title ?? null,
    imageUrl,
  };

  res.json({ data });
}

export async function getMinimumBid(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt((req.params as any)?.id);
  if (id == null) {
    res.status(400).json({ error: 'Invalid auction id' });
    return;
  }

  const sequelize = db.instance();
  if (!sequelize) {
    res.status(503).json({ error: 'Database unavailable' });
    return;
  }

  try {
    const a = await Auction.findByPk(id);
    if (!a) {
      res.status(404).json({ error: 'Auction not found' });
      return;
    }

    const minNextBidCents = minimumAcceptableBid(a);
    res.json({ minNextBidCents });
  } catch {
    res.status(500).json({ error: 'Failed to compute minimum bid' });
  }
}

export async function placeBid(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;
  if (!ensureAdult(req, res)) return;

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
      const a = await Auction.findByPk(auctionId, { transaction: tx, lock: true });
      if (!a) return { ok: false as const, error: 'Auction not found' };

      const now = new Date();
      if (a.status !== 'live') return { ok: false as const, error: 'Auction is not live' };
      if (a.endAt && now >= new Date(a.endAt)) return { ok: false as const, error: 'Auction has ended' };

      const product = await Product.findByPk(a.productId, { transaction: tx });
      const vendorId = typeof (req as any).user?.vendorId === 'number' ? (req as any).user.vendorId : null;
      if (product && vendorId && product.vendorId === vendorId) {
        return { ok: false as const, error: 'Vendors cannot bid on their own items' };
      }

      const minAcceptable = minimumAcceptableBid(a);
      if (amountCents < minAcceptable) {
        return { ok: false as const, error: `Bid must be at least ${centsToUsd(minAcceptable)}` };
      }

      const userId = Number((req as any).user.id);
      return placeBidTx(tx, a, userId, amountCents, maxProxyCents);
    });

    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    const fresh = await Auction.findByPk(auctionId);
    const io = getIO(req);
    if (io) {
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

    try {
      const bidder = await User.findByPk((req as any).user.id, { attributes: ['email'] });
      if (bidder?.email) {
        await sendBidEmail('bid_placed', {
          to: { email: bidder.email, name: null },
          auctionTitle: fresh?.title ?? 'Auction',
          amountCents: result.highBidCents ?? 0,
          auctionId,
        });
        if (result.youAreLeading) {
          await sendBidEmail('bid_leading', {
            to: { email: bidder.email, name: null },
            auctionTitle: fresh?.title ?? 'Auction',
            amountCents: result.highBidCents ?? 0,
            auctionId,
          });
        }
      }
    } catch {}

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

export async function buyNow(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;
  if (!ensureAdult(req, res)) return;

  const auctionId = parsePositiveInt((req.params as any)?.id);
  if (auctionId == null) {
    res.status(400).json({ error: 'Invalid auctionId' });
    return;
  }

  const sequelize = db.instance();
  if (!sequelize) {
    res.status(503).json({ ok: false, code: 'DB_UNAVAILABLE' });
    return;
  }

  try {
    const result = await sequelize.transaction(async (tx) => {
      const a = await Auction.findByPk(auctionId, { transaction: tx, lock: (tx as any).LOCK?.UPDATE });
      if (!a) return { ok: false as const, code: 'NOT_FOUND' as const };
      if (a.status === 'ended' || a.status === 'canceled') return { ok: false as const, code: 'ALREADY_FINAL' as const };
      if (a.buyNowPriceCents == null) return { ok: false as const, code: 'BUY_NOW_DISABLED' as const };
      const userId = (req as any).user.id as number;
      a.highBidUserId = Number(userId);
      a.highBidCents = Number(a.buyNowPriceCents);
      await a.save({ transaction: tx });
      const r = await endAuctionTx(tx, auctionId, { kind: 'admin' }, 'manual_close');
      return { ok: true as const, auction: r.auction };
    });

    if (!result.ok) {
      const code = result.code;
      if (code === 'NOT_FOUND') { res.status(404).json({ ok: false, code }); return; }
      if (code === 'ALREADY_FINAL') { res.status(409).json({ ok: false, code }); return; }
      if (code === 'BUY_NOW_DISABLED') { res.status(400).json({ ok: false, code }); return; }
      res.status(400).json({ ok: false, code: 'INVALID' });
      return;
    }

    const io = getIO(req);
    if (io) emitAuctionEnded(io, auctionId, { reason: 'buy-now' });
    res.status(200).json({ ok: true, auction: { id: result.auction.id, status: result.auction.status, endAt: result.auction.endAt } });
  } catch {
    res.status(500).json({ ok: false, code: 'SERVER_ERROR' });
  }
}
