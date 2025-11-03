// Server/src/controllers/auctionsReadWrite.controller.ts
import type {Request, Response} from 'express';
import type {Transaction} from 'sequelize';
import type {Server as IOServer} from 'socket.io';
import {db} from '../models/sequelize.js';
import {Auction} from '../models/auction.model.js';
import {Product} from '../models/product.model.js';
import {AuctionWatchlist} from '../models/auctionWatchlist.model.js';
import {bidParamsSchema, createAuctionBodySchema} from '../validation/auctions.schema.js';
import {emitAuctionEnded} from '../sockets/emitters/auctions.emit.js';
import {cancelAuctionTx, type EndAuctionReason, endAuctionTx, assertAuctionStartAllowed} from '../services/auction.service.js';
import {logError, logInfo} from '../services/log.service.js';

// Utility: resolve Socket.io instance if registered on app (no-throw)
function resolveIO(req: Request): IOServer | null {
  try {
    const io = req.app.get('io') as IOServer | undefined;
    return io ?? null;
  } catch {
    return null;
  }
}

// POST /auctions (vendor)
export async function createAuction(req: Request, res: Response) {
  const z = createAuctionBodySchema.safeParse(req.body);
  if (!z.success) {
    res.status(400).json({ ok: false, code: 'VALIDATION_FAILED', errors: z.error.issues });
    return;
  }

  const u = (req as any).user ?? null;
  const sessionVendorId = Number(u?.vendorId);
  if (!Number.isFinite(sessionVendorId) || sessionVendorId <= 0) {
    res.status(403).json({ ok: false, code: 'VENDOR_REQUIRED' });
    return;
  }

  const s = db.instance();
  if (!s) {
    res.status(503).json({ ok: false, code: 'DB_UNAVAILABLE' });
    return;
  }

  try {
    const result = await s.transaction(async (tx: Transaction) => {
      const product = await Product.findByPk(z.data.productId, { transaction: tx, lock: true as any });
      if (!product) return { ok: false as const, status: 404 as const, code: 'PRODUCT_NOT_FOUND' as const };

      const productVendorId = Number(
        (product as any).getDataValue?.('vendorId') ?? (product as any).vendorId
      );
      if (!Number.isFinite(productVendorId) || productVendorId !== sessionVendorId) {
        logInfo('auction.create.ownership_mismatch', {
          productId: z.data.productId,
          productVendorId,
          sessionVendorId,
        });
        return { ok: false as const, status: 403 as const, code: 'PRODUCT_NOT_OWNED' as const };
      }

      await assertAuctionStartAllowed(Number(product.id), tx);

      const now = new Date();
      const endAt = new Date(now.getTime() + z.data.durationDays * 24 * 60 * 60 * 1000);

      const a = await Auction.create(
        {
          productId: Number(product.id),
          vendorId: sessionVendorId,
          title: z.data.title,
          status: 'live',
          startAt: now,
          endAt,
          startPriceCents: z.data.startingBidCents ?? 0,
          reservePriceCents: z.data.reserveCents ?? null,
          buyNowPriceCents: z.data.buyNowCents ?? null,
          incrementLadderJson: z.data.incrementLadderJson ?? null,
          highBidCents: null,
          highBidUserId: null,
        } as any,
        { transaction: tx }
      );

      return { ok: true as const, id: Number(a.id) };
    });

    if (!result.ok) {
      const status = result.status ?? 400;
      res.status(status).json({ ok: false, code: result.code ?? 'INVALID' });
      return;
    }

    res.status(201).json({ ok: true, id: result.id });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg === 'AUCTION_EXISTS' || msg === 'AUCTION_LOCK_ACTIVE') {
      res.status(409).json({ ok: false, code: msg, productId: z.success ? z.data.productId : undefined });
      return;
    }
    logError('auction.create.error', { err: String(msg) });
    res.status(500).json({ ok: false, code: 'AUCTION_CREATE_FAILED' });
  }
}

// POST /auctions/:id/watch
export async function watchAuction(req: Request, res: Response) {
  const parsed = bidParamsSchema.safeParse(req.params);
  const u = (req as any).user ?? null;
  if (!parsed.success || !u?.id) {
    res.status(400).json({ ok: false, code: 'VALIDATION_FAILED' });
    return;
  }

  await AuctionWatchlist.findOrCreate({
    where: { auctionId: parsed.data.id, userId: u.id },
    defaults: { auctionId: parsed.data.id, userId: u.id },
  });

  res.json({ ok: true });
}

// DELETE /auctions/:id/watch
export async function unwatchAuction(req: Request, res: Response) {
  const parsed = bidParamsSchema.safeParse(req.params);
  const u = (req as any).user ?? null;
  if (!parsed.success || !u?.id) {
    res.status(400).json({ ok: false, code: 'VALIDATION_FAILED' });
    return;
  }

  await AuctionWatchlist.destroy({ where: { auctionId: parsed.data.id, userId: u.id } });
  res.json({ ok: true });
}

/* ---------------------------------------------------------------------------
 * Week 6: Manual close / cancel endpoints (vendor owner or admin)
 * -------------------------------------------------------------------------*/

// Helper to determine actor (vendor vs admin)
function getActor(req: Request): { kind: 'vendor'; vendorId: number } | { kind: 'admin' } {
  const u = (req as any).user ?? null;
  if (!u) throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' as const });

  const role = String(u.role ?? '');
  const isAdmin = role === 'admin' || role === 'owner' || role === 'superadmin';
  if (isAdmin) return { kind: 'admin' };

  const vendorId = Number(u.vendorId ?? 0);
  if (!vendorId) throw Object.assign(new Error('Vendor required'), { code: 'VENDOR_REQUIRED' as const });

  return { kind: 'vendor', vendorId };
}

/** POST /auctions/:id/close — manual close (vendor owner or admin) */
export async function closeAuction(req: Request, res: Response) {
  const z = bidParamsSchema.safeParse(req.params);
  if (!z.success) {
    res.status(400).json({ ok: false, code: 'VALIDATION_FAILED', errors: z.error.issues });
    return;
  }

  let actor: ReturnType<typeof getActor>;
  try {
    actor = getActor(req);
  } catch (e: any) {
    let statusCode = 403;
    if (e?.code === 'UNAUTHORIZED') statusCode = 401;
    res.status(statusCode).json({ ok: false, code: e?.code ?? 'FORBIDDEN' });
    return;
  }

  const s = db.instance();
  if (!s) {
    res.status(503).json({ ok: false, code: 'DB_UNAVAILABLE' });
    return;
  }

  const io = resolveIO(req);
  const auctionId = z.data.id;

  try {
    const result = await s.transaction(async (tx: Transaction) => {
      // Vendor authorization double-check: ensure vendor owns it (admin bypass)
      if (actor.kind === 'vendor') {
        const a = await Auction.findByPk(auctionId, { transaction: tx });
        if (!a) throw Object.assign(new Error('Auction not found'), { code: 'NOT_FOUND' as const });
        if (a.vendorId !== actor.vendorId) {
          throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' as const });
        }
      }

      return await endAuctionTx(tx, auctionId, actor, 'manual_close' as EndAuctionReason);
    });

    // Broadcast (even if alreadyFinal to keep clients in sync)
    if (io) {
      // Conform to existing type: only { reason?: string }
      emitAuctionEnded(io, result.auction.id, { reason: result.reason });
    }

    res.json({
      ok: true,
      code: result.alreadyFinal ? 'ALREADY_FINAL' : 'ENDED',
      auction: {
        id: result.auction.id,
        status: result.auction.status,
        endAt: result.auction.endAt,
        highBidCents: result.auction.highBidCents,
      },
    });
  } catch (e: any) {
    const code = e?.code;
    if (code === 'NOT_FOUND') {
      res.status(404).json({ ok: false, code });
      return;
    }
    if (code === 'FORBIDDEN') {
      res.status(403).json({ ok: false, code });
      return;
    }
    if (code === 'INVALID_STATE') {
      res.status(409).json({ ok: false, code });
      return;
    }
    logError('auction.close.failed', { auctionId, err: String(e?.message ?? e) });
    res.status(500).json({ ok: false, code: 'SERVER_ERROR' });
  }
}

/** POST /auctions/:id/cancel — cancel (vendor owner or admin) */
export async function cancelAuction(req: Request, res: Response) {
  const z = bidParamsSchema.safeParse(req.params);
  if (!z.success) {
    res.status(400).json({ ok: false, code: 'VALIDATION_FAILED', errors: z.error.issues });
    return;
  }

  let actor: ReturnType<typeof getActor>;
  try {
    actor = getActor(req);
  } catch (e: any) {
    let statusCode = 403;
    if (e?.code === 'UNAUTHORIZED') statusCode = 401;
    res.status(statusCode).json({ ok: false, code: e?.code ?? 'FORBIDDEN' });
    return;
  }

  const s = db.instance();
  if (!s) {
    res.status(503).json({ ok: false, code: 'DB_UNAVAILABLE' });
    return;
  }

  const io = resolveIO(req);
  const auctionId = z.data.id;

  try {
    const result = await s.transaction(async (tx: Transaction) => {
      // Vendor authorization double-check: ensure vendor owns it (admin bypass)
      if (actor.kind === 'vendor') {
        const a = await Auction.findByPk(auctionId, { transaction: tx });
        if (!a) throw Object.assign(new Error('Auction not found'), { code: 'NOT_FOUND' as const });
        if (a.vendorId !== actor.vendorId) {
          throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' as const });
        }
      }

      return await cancelAuctionTx(tx, auctionId, actor);
    });

    // Broadcast (even if alreadyFinal to keep clients in sync)
    if (io) {
      // Conform to existing type: only { reason?: string }
      emitAuctionEnded(io, result.auction.id, { reason: result.reason });
    }

    res.json({
      ok: true,
      code: result.alreadyFinal ? 'ALREADY_FINAL' : 'CANCELED',
      auction: {
        id: result.auction.id,
        status: result.auction.status,
        endAt: result.auction.endAt,
        highBidCents: result.auction.highBidCents,
      },
    });
  } catch (e: any) {
    const code = e?.code;
    if (code === 'NOT_FOUND') {
      res.status(404).json({ ok: false, code });
      return;
    }
    if (code === 'FORBIDDEN') {
      res.status(403).json({ ok: false, code });
      return;
    }
    if (code === 'INVALID_STATE') {
      res.status(409).json({ ok: false, code });
      return;
    }
    logError('auction.cancel.failed', { auctionId, err: String(e?.message ?? e) });
    res.status(500).json({ ok: false, code: 'SERVER_ERROR' });
  }
}
