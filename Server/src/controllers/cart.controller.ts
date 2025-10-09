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

// ✅ admin settings + tax helpers
import { getAdminSettingsCached } from '../services/settings.service.js';
import { calcTaxCents, taxFeatureEnabled } from '../services/tax.service.js';

// ✅ NEW: product images + public route to build URLs
import { ProductImage } from '../models/productImage.model.js';
import { UPLOADS_PUBLIC_ROUTE } from './products.controller.js';

/** Public URL from a stored relative path */
function toPublicUrl(rel?: string | null): string | null {
  if (!rel) return null;
  const clean = String(rel).replace(/^\/+/, '');
  return `${UPLOADS_PUBLIC_ROUTE}/${encodeURI(clean)}`;
}

/** ---------------- Zod error helper (no deprecated APIs) ---------------- */
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

/** ---------------- Availability guard (staleness) ---------------- */
async function validateAvailability(productIds: number[]) {
  if (productIds.length === 0) {
    return { ok: true as const, unavailable: [] as Array<{ productId: number; reason: string }> };
  }

  const rows = await Product.findAll({
    where: { id: { [Op.in]: productIds } },
    attributes: ['id', 'archivedAt'],
  });

  const unavailable: Array<{ productId: number; reason: string }> = [];
  for (const p of rows) {
    const archived = (p as any).archivedAt != null;
    if (archived) {
      unavailable.push({ productId: Number(p.id), reason: 'archived' });
    }
  }

  if (unavailable.length > 0) {
    return { ok: false as const, unavailable };
  }
  return { ok: true as const, unavailable: [] as Array<{ productId: number; reason: string }> };
}

/** ---------------- Totals helper ----------------
 * Enrich each line with:
 *   - imageUrl (cover image: primary → sortOrder → id)
 *   - unitPriceCents (sale-aware if instance exposes getEffectivePriceCents)
 *   - priceCents (alias of unitPriceCents for client convenience)
 * ---------------------------------------------------------------------- */
async function computeTotals(items: Array<{ productId: number; quantity: number }>) {
  type CartLine = {
    productId: number;
    vendorId: number;
    title: string;
    unitPriceCents: number;
    priceCents: number;       // alias for client
    quantity: number;
    lineTotalCents: number;
    imageUrl: string | null;  // cover image
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

  const ids = [...new Set(items.map((i) => Number(i.productId)))].filter((n) =>
    Number.isFinite(n)
  );
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

  // Fetch products + a single “cover” image (primary first, then sortOrder)
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
    ],
  });

  const byId = new Map<number, any>();
  for (const p of products) byId.set(Number((p as any).id), p);

  const lines: CartLine[] = [];
  let subtotalCents = 0;

  // Group concrete Product instances per vendor for rule-based shipping
  const vendorGroups = new Map<number, Array<{ product: Product; quantity: number }>>();

  for (const row of items) {
    const p = byId.get(Number(row.productId));
    if (!p) continue; // silently drop unknown/archived

    const qty = Math.max(0, Math.trunc(Number(row.quantity || 0)));
    if (qty <= 0) continue;

    // Prefer instance method if available; fall back to base price
    let unitPrice = 0;
    try {
      // @ts-ignore optional instance method
      unitPrice =
        typeof (p).getEffectivePriceCents === 'function'
          ? Number((p).getEffectivePriceCents())
          : Number((p).priceCents || 0);
    } catch {
      unitPrice = Number((p).priceCents || 0);
    }
    if (!Number.isFinite(unitPrice)) unitPrice = 0;

    const j = p.toJSON();
    const cover = Array.isArray(j.images) && j.images[0] ? j.images[0] : null;
    const rel =
      cover?.v800Path || cover?.v320Path || cover?.v1600Path || cover?.origPath || null;
    const imageUrl = toPublicUrl(rel);

    const lineTotal = Math.round(unitPrice * qty);
    subtotalCents += lineTotal;

    const vendorId = Number(j.vendorId);
    if (!vendorGroups.has(vendorId)) vendorGroups.set(vendorId, []);
    vendorGroups.get(vendorId)!.push({ product: p, quantity: qty });

    lines.push({
      productId: Number(j.id),
      vendorId,
      title: String(j.title || ''),
      unitPriceCents: unitPrice,
      priceCents: unitPrice, // alias
      quantity: qty,
      lineTotalCents: lineTotal,
      imageUrl,
    });
  }

  // Per-vendor shipping via rules (vendor → global default → admin defaults → sane default)
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

  // tax from admin settings (subtotal-only)
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

/** ------------------------------------------------------------------------
 * Cart endpoints
 * -----------------------------------------------------------------------*/
export async function getCart(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  const userId = (req as any).user.id;
  const cart = await Cart.findOne({ where: { userId } });

  // ✅ filter out any zero/invalid quantities
  const raw: Array<{ productId: unknown; quantity: unknown }> = (cart?.itemsJson as any) ?? [];
  const items = raw
    .map((x) => ({
      productId: Number(x.productId),
      quantity: Math.max(0, Math.trunc(Number(x.quantity ?? 0))),
    }))
    .filter((x) => Number.isFinite(x.productId) && x.productId > 0 && x.quantity > 0);

  const totals = await computeTotals(items);

  res.json({
    items: totals.lines, // includes imageUrl, priceCents, unitPriceCents
    totals: {
      subtotal: totals.subtotalCents,
      shipping: totals.shippingCents,
      tax: totals.taxCents,
      total: totals.totalCents,
    },
    tax: {
      enabled: taxFeatureEnabled, // boolean, not callable
      label: totals.taxLabel ?? null,
      rateBps: Number((await getAdminSettingsCached())?.tax_rate_bps ?? 0),
    },
    vendorShippingSnapshot: totals.vendorShippingSnapshot,
  });
}

export async function putCart(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  // Validate full replace payload
  const parsed = updateCartSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: zDetails(parsed.error) });
    return;
  }

  // ✅ normalize + drop zeros/invalids (treat zero as "remove")
  const normalized: Array<{ productId: number; quantity: number }> = parsed.data.items
    .map((x) => ({
      productId: Number(x.productId),
      quantity: Math.max(0, Math.trunc(Number((x as any).quantity ?? (x as any).qty ?? 0))),
    }))
    .filter((x) => Number.isFinite(x.productId) && x.productId > 0 && x.quantity > 0);

  // Staleness guard on remaining ids
  const productIds = normalized.map((x) => x.productId);
  const avail = await validateAvailability(productIds);
  if (!avail.ok) {
    res.status(409).json({
      error: 'Some items are no longer available',
      code: 'PRODUCT_UNAVAILABLE',
      unavailable: avail.unavailable, // [{ productId, reason }]
    });
    return;
  }

  const userId = (req as any).user.id;
  const totals = await computeTotals(normalized);

  // Upsert normalized items
  const now = new Date();
  const existing = await Cart.findOne({ where: { userId } });
  if (existing) {
    (existing as any).itemsJson = normalized;
    (existing as any).updatedAt = now;
    await (existing as any).save();
  } else {
    await Cart.create({
      userId,
      itemsJson: normalized,
      createdAt: now,
      updatedAt: now,
    } as any);
  }

  res.json({
    ok: true,
    items: totals.lines, // includes imageUrl, priceCents, unitPriceCents
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

  // Compute real totals from the user’s cart — rule-based
  const userId = (req as any).user.id;
  const cart = await Cart.findOne({ where: { userId } });

  // ✅ same sanitize as getCart()
  const raw: Array<{ productId: unknown; quantity: unknown }> = (cart?.itemsJson as any) ?? [];
  const items = raw
    .map((x) => ({
      productId: Number(x.productId),
      quantity: Math.max(0, Math.trunc(Number(x.quantity ?? 0))),
    }))
    .filter((x) => Number.isFinite(x.productId) && x.productId > 0 && x.quantity > 0);

  // Staleness guard before totals/PI
  const productIds = items.map((x) => x.productId);
  const avail = await validateAvailability(productIds);
  if (!avail.ok) {
    res.status(409).json({
      error: 'Some items are no longer available',
      code: 'PRODUCT_UNAVAILABLE',
      unavailable: avail.unavailable,
    });
    return;
  }

  const totals = await computeTotals(items);

  if (!totals.totalCents || totals.totalCents < 50) {
    res.status(400).json({ error: 'Cart total too low' });
    return;
  }

  const pi = await createPaymentIntent({ amountCents: totals.totalCents });
  if (!pi.ok) {
    const msg = pi.error || 'Failed to start checkout';
    res.status(502).json({ error: msg });
    return;
  }

  res.json({
    clientSecret: pi.clientSecret,
    amountCents: totals.totalCents,
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
