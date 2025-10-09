// Server/src/controllers/auctionsReadWrite.controller.ts
import type { Request, Response } from 'express';
import type { Transaction } from 'sequelize';
import { db } from '../models/sequelize.js';
import { Auction } from '../models/auction.model.js';
import { Product } from '../models/product.model.js';
import { AuctionWatchlist } from '../models/auctionWatchlist.model.js';
import { createAuctionBodySchema, bidParamsSchema } from '../validation/auctions.schema.js';
import { obs } from '../services/observability.service.js';

// POST /auctions (vendor)
export async function createAuction(req: Request, res: Response) {
  const z = createAuctionBodySchema.safeParse(req.body);
  if (!z.success) {
    res.status(400).json({ ok: false, code: 'VALIDATION_FAILED', errors: z.error.issues });
    return;
  }

  // Require a logged-in vendor; coerce BIGINTs-from-session to number
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
      // Lock the product and verify ownership
      const product = await Product.findByPk(z.data.productId, { transaction: tx, lock: true });
      if (!product) {
        return { ok: false as const, code: 'PRODUCT_NOT_FOUND' };
      }

      // PG returns BIGINT as string; normalize both sides before comparing
      const productVendorId = Number(
        (product as any).getDataValue?.('vendorId') ?? (product as any).vendorId
      );

      if (!Number.isFinite(productVendorId) || productVendorId !== sessionVendorId) {
        (obs as any)?.info?.('auction.create.ownership_mismatch', {
          productId: z.data.productId,
          productVendorId,
          sessionVendorId,
        });
        return { ok: false as const, code: 'PRODUCT_NOT_OWNED' };
      }

      const now = new Date();
      const endAt = new Date(now.getTime() + z.data.durationDays * 24 * 60 * 60 * 1000);

      // Create using columns that exist on the Auction model
      const a = await Auction.create(
        {
          productId: Number(product.id),
          vendorId: sessionVendorId,
          title: z.data.title,
          status: 'live', // MVP: go live immediately
          startAt: now,
          endAt,

          // ✅ match model column names
          startPriceCents: z.data.startingBidCents ?? 0,
          reservePriceCents: z.data.reserveCents ?? null,
          buyNowPriceCents: z.data.buyNowCents ?? null,
          incrementLadderJson: z.data.incrementLadderJson ?? null,

          highBidCents: null,
          highBidUserId: null,
        },
        { transaction: tx }
      );

      return { ok: true as const, id: a.id };
    });

    if (!result.ok) {
      res.status(400).json({ ok: false, code: result.code });
      return;
    }

    res.status(201).json({ ok: true, id: result.id });
  } catch (err: unknown) {
    obs.error(req, 'auction.create.error', err);
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
