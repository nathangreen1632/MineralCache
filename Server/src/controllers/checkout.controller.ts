// Server/src/controllers/checkout.controller.ts
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Cart } from '../models/cart.model.js';
import { Product } from '../models/product.model.js';
import { createPaymentIntent } from '../services/stripe.service.js';
import { Commission } from '../config/fees.config.js';

/** Server-side cart → totals */
async function computeCartTotals(userId: number) {
  const cart = await Cart.findOne({ where: { userId } });
  if (!cart) {
    return { empty: true as const, subtotalCents: 0, shippingCents: 0, totalCents: 0, itemCount: 0, lines: [] as any[] };
  }

  const items: Array<{ productId: number; quantity: number }> = Array.isArray((cart as any).itemsJson)
    ? (cart as any).itemsJson
    : [];

  if (items.length === 0) {
    return { empty: true as const, subtotalCents: 0, shippingCents: 0, totalCents: 0, itemCount: 0, lines: [] as any[] };
  }

  const ids = [...new Set(items.map(i => Number(i.productId)))].filter(n => Number.isFinite(n));
  if (ids.length === 0) {
    return { empty: true as const, subtotalCents: 0, shippingCents: 0, totalCents: 0, itemCount: 0, lines: [] as any[] };
  }

  const products = await Product.findAll({
    where: { id: { [Op.in]: ids }, archivedAt: { [Op.is]: null } as any },
    attributes: ['id', 'vendorId', 'title', 'priceCents', 'salePriceCents'],
  });

  const byId = new Map(products.map(p => [Number(p.id), p]));
  const lines: Array<{
    productId: number;
    title: string;
    vendorId: number;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }> = [];

  let subtotalCents = 0;
  let itemCount = 0;

  for (const it of items) {
    const qty = Number(it.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const p = byId.get(Number(it.productId));
    if (!p) continue;

    // Respect your model’s effective price helper if available; otherwise fall back.
    let unitPrice = 0;
    try {
      // @ts-ignore optional instance method
      unitPrice = typeof (p as any).getEffectivePriceCents === 'function'
        ? Number((p as any).getEffectivePriceCents())
        : Number((p as any).priceCents || 0);
    } catch {
      unitPrice = Number((p as any).priceCents || 0);
    }

    const lineTotal = Math.round(unitPrice * qty);
    subtotalCents += lineTotal;
    itemCount += qty;

    lines.push({
      productId: Number(p.id),
      vendorId: Number((p as any).vendorId),
      title: String((p as any).title ?? ''),
      quantity: qty,
      unitPriceCents: unitPrice,
      lineTotalCents: lineTotal,
    });
  }

  // Shipping: Week-3 “shipping rules” comes next; for now keep it 0 and carry metadata.
  const shippingCents = 0;

  const totalCents = subtotalCents + shippingCents;

  return {
    empty: totalCents <= 0 ? (true as const) : (false as const),
    subtotalCents,
    shippingCents,
    totalCents,
    itemCount,
    lines,
  };
}

/** POST /api/checkout/intent → returns { clientSecret } */
export async function createCheckoutIntent(req: Request, res: Response): Promise<void> {
  const u = (req as any).user ?? (req.session as any)?.user ?? null;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!u.dobVerified18) {
    res.status(403).json({ error: 'Age verification required', code: 'AGE_VERIFICATION_REQUIRED' });
    return;
  }

  const totals = await computeCartTotals(Number(u.id));
  if (totals.empty || totals.totalCents <= 0) {
    res.status(400).json({ error: 'Cart is empty' });
    return;
  }

  // Platform fee (8% + $0.75) — computed now; persisted to Order in the Orders E2E step.
  const pct = Number(Commission.globalPct ?? 0.08);
  const minFee = Number(Commission.minFeeCents ?? 75);
  const platformFeeCents = Math.max(Math.round(totals.subtotalCents * pct), minFee);

  const currency = String(process.env.CURRENCY ?? 'usd').toLowerCase();

  // Use your requestId middleware for idempotency
  const idempotencyKey = `checkout:${String((req as any).id ?? '')}:${String(u.id)}`;

  const meta = {
    userId: String(u.id),
    itemCount: String(totals.itemCount),
    subtotalCents: String(totals.subtotalCents),
    shippingCents: String(totals.shippingCents),
    platformFeeCents: String(platformFeeCents),
    // NOTE: We are NOT setting application_fee_amount (Connect is off). We carry this in metadata.
  };

  const result = await createPaymentIntent({
    amountCents: totals.totalCents,
    currency,
    metadata: meta,
    idempotencyKey,
  });

  // ✅ Narrow the union before touching `error`
  if (!result.ok) {
    res.status(503).json({ error: result.error || 'Failed to create PaymentIntent' });
    return;
  }
  if (!result.clientSecret) {
    // Extremely unlikely, but keeps TS happy and guards runtime
    res.status(503).json({ error: 'Failed to create PaymentIntent' });
    return;
  }

  res.json({ clientSecret: result.clientSecret });
}
