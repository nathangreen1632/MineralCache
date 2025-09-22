// Server/src/controllers/cart.controller.ts
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { z, type ZodError } from 'zod';
import { stripeEnabled, createPaymentIntent } from '../services/stripe.service.js';
import { ensureAuthed, ensureAdult } from '../middleware/authz.middleware.js';
import { Cart } from '../models/cart.model.js';
import { Product } from '../models/product.model.js';
import { updateCartSchema } from '../validation/cart.schema.js';

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
 * - subtotalCents = sum(priceCents * qty)
 * - shippingCents = flat per unique vendor (DEFAULT_SHIPPING_CENTS)
 * - totalCents = subtotal + shipping
 * TODO(ship): allow per-vendor overrides from settings or vendor table
 * ---------------------------------------------------------------------- */
const DEFAULT_SHIPPING_CENTS = Number(process.env.DEFAULT_SHIPPING_CENTS ?? 0);

async function computeTotals(items: Array<{ productId: number; quantity: number }>) {
  if (!items.length) {
    return {
      lines: [],
      vendors: [],
      subtotalCents: 0,
      shippingCents: 0,
      totalCents: 0,
    };
  }

  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await Product.findAll({
    where: { id: { [Op.in]: ids }, archivedAt: { [Op.is]: null } as any },
    attributes: ['id', 'vendorId', 'title', 'priceCents'],
  });

  const byId = new Map(products.map((p) => [Number(p.id), p]));
  const lines: Array<{
    productId: number;
    vendorId: number;
    title: string;
    priceCents: number;
    quantity: number;
    lineTotalCents: number;
  }> = [];

  const vendorSet = new Set<number>();
  let subtotalCents = 0;

  for (const row of items) {
    const p = byId.get(row.productId);
    if (!p) continue; // silently drop unknown/archived
    const qty = row.quantity;
    const price = (p as any).priceCents as number;
    const line = price * qty;
    subtotalCents += line;
    vendorSet.add(Number((p as any).vendorId));
    lines.push({
      productId: row.productId,
      vendorId: Number((p as any).vendorId),
      title: (p as any).title as string,
      priceCents: price,
      quantity: qty,
      lineTotalCents: line,
    });
  }

  const vendors = [...vendorSet];
  const shippingCents = vendors.length * DEFAULT_SHIPPING_CENTS; // TODO(ship): per-vendor rates
  const totalCents = subtotalCents + shippingCents;

  return { lines, vendors, subtotalCents, shippingCents, totalCents };
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
    existing.itemsJson = items;
    existing.updatedAt = now;
    await existing.save();
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
  });
}

export async function checkout(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;
  if (!ensureAdult(req, res)) return;

  if (!stripeEnabled) {
    res.status(503).json({ error: 'Payments disabled' });
    return;
  }

  // TODO: compute real totals from the user’s cart — done here
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
  });
}
