// Server/src/controllers/cart.controller.ts
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { z, type ZodError } from 'zod';
import { stripeEnabled, createPaymentIntent } from '../services/stripe.service.js';
import { ensureAuthed, ensureAdult } from '../middleware/authz.middleware.js';
import { Cart } from '../models/cart.model.js';
import { Product } from '../models/product.model.js';
import { updateCartSchema } from '../validation/cart.schema.js';
import { computeVendorShippingByLines } from '../services/shipping.service.js';
import { getAdminSettingsCached } from '../services/settings.service.js';
import { calcTaxCents, taxFeatureEnabled } from '../services/tax.service.js';
import { ProductImage } from '../models/productImage.model.js';
import { UPLOADS_PUBLIC_ROUTE } from './products.controller.js';
import { AuctionLock } from '../models/auctionLock.model.js';
import { Vendor } from '../models/vendor.model.js';

function toPublicUrl(rel?: string | null): string | null {
  if (!rel) return null;
  const clean = String(rel).replace(/^\/+/, '');
  return `${UPLOADS_PUBLIC_ROUTE}/${encodeURI(clean)}`;
}

function zDetails(err: ZodError) {
  const treeify = (z as any).treeifyError;
  if (typeof treeify === 'function') return treeify(err);
  return {
    issues: err.issues.map((i) => ({
      path: Array.isArray(i.path) ? i.path.join('.') : String(i.path ?? ''),
      message: i.message,
      code: i.code,
    })),
  };
}

async function validateAvailability(productIds: number[], userId: number) {
  if (productIds.length === 0) {
    return { ok: true as const, unavailable: [] as Array<{ productId: number; reason: string }> };
  }

  const rows = await Product.findAll({
    where: { id: { [Op.in]: productIds } },
    attributes: ['id', 'archivedAt'],
  });

  const now = new Date();
  const locks = await AuctionLock.findAll({
    where: { productId: { [Op.in]: productIds }, status: 'active' },
    attributes: ['productId', 'userId', 'expiresAt'],
  });

  const lockByProduct = new Map<number, { userId: number; expiresAt: Date }>();
  for (const l of locks) {
    lockByProduct.set(Number(l.productId), { userId: Number(l.userId), expiresAt: new Date(String(l.expiresAt)) });
  }

  const unavailable: Array<{ productId: number; reason: string }> = [];
  for (const p of rows) {
    const pid = Number(p.id);
    if ((p as any).archivedAt != null) {
      unavailable.push({ productId: pid, reason: 'archived' });
      continue;
    }
    const lock = lockByProduct.get(pid);
    if (lock) {
      if (lock.expiresAt > now && Number(userId) !== Number(lock.userId)) {
        unavailable.push({ productId: pid, reason: 'reserved' });
      }
      if (lock.expiresAt <= now) {
        await AuctionLock.update({ status: 'released' }, { where: { productId: pid, status: 'active' } });
      }
    }
  }

  if (unavailable.length > 0) {
    return { ok: false as const, unavailable };
  }
  return { ok: true as const, unavailable: [] as Array<{ productId: number; reason: string }> };
}

async function computeTotals(items: Array<{ productId: number; quantity: number }>, userId: number) {
  type CartLine = {
    productId: number;
    vendorId: number;
    vendorSlug: string | null;
    title: string;
    unitPriceCents: number;
    priceCents: number;
    quantity: number;
    lineTotalCents: number;
    imageUrl: string | null;
  };

  if (!items.length) {
    return {
      lines: [] as CartLine[],
      vendors: [] as number[],
      subtotalCents: 0,
      shippingCents: 0,
      taxCents: 0,
      taxLabel: null as string | null,
      totalCents: 0,
      vendorShippingSnapshot: {} as Record<
        string,
        { cents: number; ruleId: number | null; label: string; params: any }
      >,
    };
  }

  const ids = [...new Set(items.map((i) => Number(i.productId)))].filter((n) => Number.isFinite(n));
  if (ids.length === 0) {
    return {
      lines: [] as CartLine[],
      vendors: [] as number[],
      subtotalCents: 0,
      shippingCents: 0,
      taxCents: 0,
      taxLabel: null as string | null,
      totalCents: 0,
      vendorShippingSnapshot: {} as Record<
        string,
        { cents: number; ruleId: number | null; label: string; params: any }
      >,
    };
  }

  const products = await Product.findAll({
    where: { id: { [Op.in]: ids }, archivedAt: { [Op.is]: null } as any },
    attributes: ['id', 'vendorId', 'title', 'priceCents', 'salePriceCents', 'saleStartAt', 'saleEndAt'],
    include: [
      {
        model: ProductImage,
        as: 'images',
        attributes: ['v800Path', 'v320Path', 'v1600Path', 'origPath', 'isPrimary', 'sortOrder'],
        separate: true,
        limit: 1,
        order: [
          ['isPrimary', 'DESC'],
          ['sortOrder', 'ASC'],
          ['id', 'ASC'],
        ],
      },
      {
        model: Vendor,
        as: 'vendor',
        attributes: ['id', 'slug'],
        required: false,
      },
    ],
  });

  const locks = await AuctionLock.findAll({
    where: { productId: { [Op.in]: ids }, status: 'active', userId },
    attributes: ['productId', 'priceCents', 'expiresAt'],
  });

  const lockMap = new Map<number, { priceCents: number; expiresAt: Date }>();
  const now = new Date();
  for (const l of locks) {
    const exp = new Date(String(l.expiresAt));
    if (exp > now) lockMap.set(Number(l.productId), { priceCents: Number(l.priceCents), expiresAt: exp });
  }

  const byId = new Map<number, any>();
  for (const p of products) byId.set(Number((p as any).id), p);

  const lines: CartLine[] = [];
  let subtotalCents = 0;
  const vendorGroups = new Map<number, Array<{ product: Product; quantity: number }>>();

  for (const row of items) {
    const p = byId.get(Number(row.productId));
    if (!p) continue;

    const qty = Math.max(0, Math.trunc(Number(row.quantity || 0)));
    if (qty <= 0) continue;

    const lock = lockMap.get(Number(row.productId));

    let unitPrice = 0;
    if (lock) {
      unitPrice = Number(lock.priceCents);
    } else {
      try {
        unitPrice =
          typeof p.getEffectivePriceCents === 'function'
            ? Number(p.getEffectivePriceCents())
            : Number((p).priceCents || 0);
      } catch {
        unitPrice = Number((p).priceCents || 0);
      }
    }
    if (!Number.isFinite(unitPrice)) unitPrice = 0;

    const j = p.toJSON();
    const cover = Array.isArray(j.images) && j.images[0] ? j.images[0] : null;
    const rel = cover?.v800Path || cover?.v320Path || cover?.v1600Path || cover?.origPath || null;
    const imageUrl = toPublicUrl(rel);

    const lineTotal = Math.round(unitPrice * qty);
    subtotalCents += lineTotal;

    const vendorId = Number(j.vendorId);
    if (!vendorGroups.has(vendorId)) vendorGroups.set(vendorId, []);
    vendorGroups.get(vendorId)!.push({ product: p, quantity: qty });

    lines.push({
      productId: Number(j.id),
      vendorId,
      vendorSlug: j.vendor?.slug ?? null,
      title: String(j.title || ''),
      unitPriceCents: unitPrice,
      priceCents: unitPrice,
      quantity: qty,
      lineTotalCents: lineTotal,
      imageUrl,
    });
  }

  const vendorShippingSnapshot: Record<
    string,
    { cents: number; ruleId: number | null; label: string; params: any }
  > = {};
  for (const [vendorId, groupItems] of vendorGroups.entries()) {
    const { shippingCents, snapshot } = await computeVendorShippingByLines({
      vendorId,
      items: groupItems,
    });

    vendorShippingSnapshot[String(vendorId)] = {
      cents: shippingCents,
      ruleId: snapshot.ruleId,
      label: snapshot.label,
      params: {
        baseCents: snapshot.baseCents,
        perItemCents: snapshot.perItemCents,
        perWeightCents: snapshot.perWeightCents,
        minCents: snapshot.minCents,
        maxCents: snapshot.maxCents,
        freeThresholdCents: snapshot.freeThresholdCents,
        source: snapshot.source,
      },
    };
  }

  const shippingCents = Object.values(vendorShippingSnapshot).reduce(
    (sum, v) => sum + Number((v as any).cents || 0),
    0
  );

  const settings = await getAdminSettingsCached();
  const taxRateBps = Number(settings?.tax_rate_bps ?? 0);
  const taxLabel: string | null = settings?.tax_label ?? null;
  const taxCents = calcTaxCents(subtotalCents, taxRateBps);

  const totalCents = subtotalCents + shippingCents + taxCents;
  const vendors = [...vendorGroups.keys()];

  return {
    lines,
    vendors,
    subtotalCents,
    shippingCents,
    taxCents,
    taxLabel,
    totalCents,
    vendorShippingSnapshot,
  };
}

export async function getCart(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  const userId = (req as any).user.id;
  let cart = await Cart.findOne({ where: { userId } });

  const raw: Array<{ productId: unknown; quantity: unknown }> = (cart?.itemsJson as any) ?? [];
  const items = raw
    .map((x) => ({
      productId: Number(x.productId),
      quantity: Math.max(0, Math.trunc(Number(x.quantity ?? 0))),
    }))
    .filter((x) => Number.isFinite(x.productId) && x.productId > 0 && x.quantity > 0);

  const productIds = items.map((x) => x.productId);
  const avail = await validateAvailability(productIds, userId);

  let removed = [] as Array<{ productId: number; reason: string }>;
  let workingItems = items;

  if (!avail.ok) {
    const blocked = new Set(avail.unavailable.map((u) => u.productId));
    workingItems = items.filter((i) => !blocked.has(i.productId));
    removed = avail.unavailable;

    if (!cart) {
      await Cart.create({ userId, itemsJson: workingItems } as any);
    } else {
      (cart as any).itemsJson = workingItems;
      await cart.save();
    }
  }

  const totals = await computeTotals(workingItems, userId);

  res.json({
    items: totals.lines,
    removed,
    totals: {
      subtotal: totals.subtotalCents,
      shipping: totals.shippingCents,
      tax: totals.taxCents,
      total: totals.totalCents,
    },
    tax: {
      enabled: taxFeatureEnabled,
      label: totals.taxLabel ?? null,
      rateBps: Number((await getAdminSettingsCached())?.tax_rate_bps ?? 0),
    },
    vendorShippingSnapshot: totals.vendorShippingSnapshot,
  });
}

export async function putCart(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  const parsed = updateCartSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: zDetails(parsed.error) });
    return;
  }

  const userId = (req as any).user.id;

  let normalized: Array<{ productId: number; quantity: number }> = parsed.data.items
    .map((x) => ({
      productId: Number(x.productId),
      quantity: Math.max(0, Math.trunc(Number((x as any).quantity ?? (x as any).qty ?? 0))),
    }))
    .filter((x) => Number.isFinite(x.productId) && x.productId > 0 && x.quantity > 0);

  const productIds = normalized.map((x) => x.productId);
  const avail = await validateAvailability(productIds, userId);

  let removed = [] as Array<{ productId: number; reason: string }>;
  if (!avail.ok) {
    const blocked = new Set(avail.unavailable.map((u) => u.productId));
    normalized = normalized.filter((i) => !blocked.has(i.productId));
    removed = avail.unavailable;
  }

  let cart = await Cart.findOne({ where: { userId } });
  if (!cart) {
    await Cart.create({ userId, itemsJson: normalized } as any);
  } else {
    (cart as any).itemsJson = normalized;
    await cart.save();
  }

  const totals = await computeTotals(normalized, userId);

  res.json({
    ok: true,
    items: totals.lines,
    removed,
    totals: {
      subtotal: totals.subtotalCents,
      shipping: totals.shippingCents,
      tax: totals.taxCents,
      total: totals.totalCents,
    },
    tax: {
      enabled: taxFeatureEnabled,
      label: totals.taxLabel ?? null,
      rateBps: Number((await getAdminSettingsCached())?.tax_rate_bps ?? 0),
    },
    vendorShippingSnapshot: totals.vendorShippingSnapshot,
  });
}

export async function checkout(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;
  if (!ensureAdult(req, res)) return;

  if (!stripeEnabled) {
    res.status(503).json({ error: 'Payments disabled' });
    return;
  }

  const userId = (req as any).user.id;
  let cart = await Cart.findOne({ where: { userId } });

  const raw: Array<{ productId: unknown; quantity: unknown }> = (cart?.itemsJson as any) ?? [];
  let items = raw
    .map((x) => ({
      productId: Number(x.productId),
      quantity: Math.max(0, Math.trunc(Number(x.quantity ?? 0))),
    }))
    .filter((x) => Number.isFinite(x.productId) && x.productId > 0 && x.quantity > 0);

  const productIds = items.map((x) => x.productId);
  const avail = await validateAvailability(productIds, userId);

  let removed = [] as Array<{ productId: number; reason: string }>;
  if (!avail.ok) {
    const blocked = new Set(avail.unavailable.map((u) => u.productId));
    items = items.filter((i) => !blocked.has(i.productId));
    removed = avail.unavailable;

    if (!cart) {
      await Cart.create({ userId, itemsJson: items } as any);
    } else {
      (cart as any).itemsJson = items;
      await cart.save();
    }
  }

  const totals = await computeTotals(items, userId);

  if (!totals.totalCents || totals.totalCents < 50) {
    res.status(400).json({
      error: 'Cart total too low',
      removed,
    });
    return;
  }

  const pi = await createPaymentIntent({ amountCents: totals.totalCents });
  if (!pi.ok) {
    const msg = pi.error || 'Failed to start checkout';
    res.status(502).json({ error: msg, removed });
    return;
  }

  res.json({
    clientSecret: pi.clientSecret,
    amountCents: totals.totalCents,
    removed,
    totals: {
      subtotal: totals.subtotalCents,
      shipping: totals.shippingCents,
      tax: totals.taxCents,
      total: totals.totalCents,
    },
    tax: {
      enabled: taxFeatureEnabled,
      label: totals.taxLabel ?? null,
      rateBps: Number((await getAdminSettingsCached())?.tax_rate_bps ?? 0),
    },
    vendorShippingSnapshot: totals.vendorShippingSnapshot,
  });
}
