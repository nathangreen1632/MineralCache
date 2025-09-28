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

/** ---------------- Totals helper ----------------
 * Computes:
 * - subtotalCents = sum(unitPrice * qty) (sale-aware if model exposes getEffectivePriceCents)
 * - shippingCents = per-vendor via Shipping Rules (server-side, weight-aware)
 * - totalCents = subtotal + shipping
 * - vendorShippingSnapshot = per-vendor snapshot suitable to persist on Order
 * ---------------------------------------------------------------------- */
async function computeTotals(items: Array<{ productId: number; quantity: number }>) {
  if (!items.length) {
    return {
      lines: [] as Array<{
        productId: number;
        vendorId: number;
        title: string;
        unitPriceCents: number;
        quantity: number;
        lineTotalCents: number;
      }>,
      vendors: [] as number[],
      subtotalCents: 0,
      shippingCents: 0,
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
      lines: [],
      vendors: [],
      subtotalCents: 0,
      shippingCents: 0,
      totalCents: 0,
      vendorShippingSnapshot: {},
    };
  }

  const products = await Product.findAll({
    where: { id: { [Op.in]: ids }, archivedAt: { [Op.is]: null } as any },
    attributes: ['id', 'vendorId', 'title', 'priceCents', 'salePriceCents'],
  });

  const byId = new Map(products.map((p) => [Number(p.id), p]));

  const lines: Array<{
    productId: number;
    vendorId: number;
    title: string;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }> = [];

  let subtotalCents = 0;

  // Group concrete Product instances per vendor for weight-aware shipping rules
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
        typeof (p as any).getEffectivePriceCents === 'function'
          ? Number((p as any).getEffectivePriceCents())
          : Number((p as any).priceCents || 0);
    } catch {
      unitPrice = Number((p as any).priceCents || 0);
    }

    const lineTotal = Math.round(unitPrice * qty);
    subtotalCents += lineTotal;

    const vendorId = Number((p as any).vendorId);
    if (!vendorGroups.has(vendorId)) vendorGroups.set(vendorId, []);
    vendorGroups.get(vendorId)!.push({ product: p, quantity: qty });

    lines.push({
      productId: Number(p.id),
      vendorId,
      title: String((p as any).title || ''),
      unitPriceCents: unitPrice,
      quantity: qty,
      lineTotalCents: lineTotal,
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

  const totalCents = subtotalCents + shippingCents;
  const vendors = [...vendorGroups.keys()];

  return { lines, vendors, subtotalCents, shippingCents, totalCents, vendorShippingSnapshot };
}

/** ------------------------------------------------------------------------
 * Cart endpoints
 * -----------------------------------------------------------------------*/
export async function getCart(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  // TODO: fetch cart by req.user.id — done here
  const userId = (req as any).user.id;
  const cart = await Cart.findOne({ where: { userId } });
  const items: Array<{ productId: number; quantity: number }> = (cart?.itemsJson as any) ?? [];
  const totals = await computeTotals(items);

  res.json({
    items: totals.lines,
    totals: {
      subtotal: totals.subtotalCents,
      shipping: totals.shippingCents,
      total: totals.totalCents,
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

  const userId = (req as any).user.id;
  const items = parsed.data.items;

  // Optional: enforce ownership or availability here
  // TODO(stock): verify products are available / not archived beyond our basic filter

  const totals = await computeTotals(items);

  // TODO: upsert items for req.user.id from req.body — done here
  const now = new Date();
  const existing = await Cart.findOne({ where: { userId } });
  if (existing) {
    (existing as any).itemsJson = items;
    (existing as any).updatedAt = now;
    await (existing as any).save();
  } else {
    await Cart.create({
      userId,
      itemsJson: items,
      createdAt: now,
      updatedAt: now,
    } as any);
  }

  res.json({
    ok: true,
    items: totals.lines,
    totals: {
      subtotal: totals.subtotalCents,
      shipping: totals.shippingCents,
      total: totals.totalCents,
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

  // TODO: compute real totals from the user’s cart — done here (now rule-based)
  const userId = (req as any).user.id;
  const cart = await Cart.findOne({ where: { userId } });
  const items: Array<{ productId: number; quantity: number }> = (cart?.itemsJson as any) ?? [];
  const totals = await computeTotals(items);

  if (!totals.totalCents || totals.totalCents < 50) {
    // Minimum charge guard (adjust as needed)
    res.status(400).json({ error: 'Cart total too low' });
    return;
  }

  // Match your service signature: { amountCents, currency? }
  const pi = await createPaymentIntent({ amountCents: totals.totalCents });

  // Properly handle the union { ok: true | false }
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
      total: totals.totalCents,
    },
    vendorShippingSnapshot: totals.vendorShippingSnapshot,
  });
}
