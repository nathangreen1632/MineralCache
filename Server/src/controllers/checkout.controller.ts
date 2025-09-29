// Server/src/controllers/checkout.controller.ts
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Cart } from '../models/cart.model.js';
import { Product } from '../models/product.model.js';
import { Order } from '../models/order.model.js';
import { OrderItem } from '../models/orderItem.model.js';
import { createPaymentIntent } from '../services/stripe.service.js';
import { Commission } from '../config/fees.config.js';
import { db } from '../models/sequelize.js';
import { computeVendorShippingByLines } from '../services/shipping.service.js';
import { obs } from '../services/observability.service.js'; // ✅ NEW

// ✅ NEW: proportional allocator that preserves total cents exactly
function allocateProRataCents(lineTotals: number[], totalFeeCents: number): number[] {
  const n = lineTotals.length;
  if (totalFeeCents <= 0 || n === 0) return Array(n).fill(0);
  const subtotal = lineTotals.reduce((a, b) => a + Math.max(0, Number(b) || 0), 0);
  if (subtotal <= 0) return Array(n).fill(0);

  // Largest Remainder Method (Hamilton apportionment)
  const shares = lineTotals.map((lt) => (lt > 0 ? (lt / subtotal) * totalFeeCents : 0));
  const floors = shares.map((s) => Math.floor(s));
  let assigned = floors.reduce((a, b) => a + b, 0);
  let remainder = totalFeeCents - assigned;

  const remainders = shares.map((s, i) => ({ i, frac: s - Math.floor(s) }));
  remainders.sort((a, b) => b.frac - a.frac);

  const result = floors.slice();
  for (let k = 0; k < remainders.length && remainder > 0; k += 1) {
    result[remainders[k].i] += 1;
    remainder -= 1;
  }
  return result;
}

/** ---------------- Availability guard (staleness) ----------------
 * Checks a list of productIds and returns any that are unavailable.
 * Unavailable currently means: archived (p.archivedAt != null).
 * Respond with 409 if any are unavailable.
 * ---------------------------------------------------------------- */
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
    if ((p as any).archivedAt != null) {
      unavailable.push({ productId: Number(p.id), reason: 'archived' });
    }
  }

  if (unavailable.length > 0) {
    return { ok: false as const, unavailable };
  }
  return { ok: true as const, unavailable: [] as Array<{ productId: number; reason: string }> };
}

/** Server-side cart → totals + per-vendor shipping (rule-based) */
async function computeCartTotals(userId: number) {
  const cart = await Cart.findOne({ where: { userId } });
  if (!cart) {
    return {
      empty: true as const,
      subtotalCents: 0,
      shippingCents: 0,
      totalCents: 0,
      itemCount: 0,
      lines: [] as any[],
      vendorShippingSnapshot: {} as Record<string, any>,
    };
  }

  const items: Array<{ productId: number; quantity: number }> = Array.isArray(
    (cart as any).itemsJson
  )
    ? (cart as any).itemsJson
    : [];

  if (items.length === 0) {
    return {
      empty: true as const,
      subtotalCents: 0,
      shippingCents: 0,
      totalCents: 0,
      itemCount: 0,
      lines: [] as any[],
      vendorShippingSnapshot: {} as Record<string, any>,
    };
  }

  const ids = [...new Set(items.map((i) => Number(i.productId)))].filter((n) =>
    Number.isFinite(n)
  );
  if (ids.length === 0) {
    return {
      empty: true as const,
      subtotalCents: 0,
      shippingCents: 0,
      totalCents: 0,
      itemCount: 0,
      lines: [] as any[],
      vendorShippingSnapshot: {} as Record<string, any>,
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
  let itemCount = 0;

  // ✅ group real line objects per vendor for weight-aware shipping
  const vendorGroups = new Map<number, Array<{ product: Product; quantity: number }>>();

  for (const it of items) {
    const qty = Number(it.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const p = byId.get(Number(it.productId));
    if (!p) continue;

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
    itemCount += qty;

    const vendorId = Number((p as any).vendorId);

    if (!vendorGroups.has(vendorId)) {
      vendorGroups.set(vendorId, []);
    }
    vendorGroups.get(vendorId)!.push({ product: p, quantity: qty });

    lines.push({
      productId: Number(p.id),
      vendorId,
      title: String((p as any).title ?? ''),
      unitPriceCents: unitPrice,
      quantity: qty,
      lineTotalCents: lineTotal,
    });
  }

  // ---- Apply shipping rules per vendor using real lines and build snapshot
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

  return {
    empty: totalCents <= 0 ? (true as const) : (false as const),
    subtotalCents,
    shippingCents,
    totalCents,
    itemCount,
    lines,
    vendorShippingSnapshot,
  };
}

/** POST /api/checkout/intent → returns { clientSecret } and creates pending Order/Items */
export async function createCheckoutIntent(
  req: Request,
  res: Response
): Promise<void> {
  const u = (req as any).user ?? (req.session as any)?.user ?? null;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!u.dobVerified18) {
    res
      .status(403)
      .json({ error: 'Age verification required', code: 'AGE_VERIFICATION_REQUIRED' });
    return;
  }

  // ✅ Staleness guard — check cart items against archived products BEFORE totals/PI
  const cartForGuard = await Cart.findOne({ where: { userId: Number(u.id) } });
  const cartItemsForGuard: Array<{ productId: number; quantity: number }> = Array.isArray(
    (cartForGuard as any)?.itemsJson
  )
    ? ((cartForGuard as any).itemsJson as Array<{ productId: number; quantity: number }>)
    : [];

  const productIds = cartItemsForGuard
    .map((x) => Number((x as any)?.productId))
    .filter((n) => Number.isFinite(n));

  const availability = await validateAvailability(productIds);
  if (!availability.ok) {
    res.status(409).json({
      error: 'Some items are no longer available',
      code: 'PRODUCT_UNAVAILABLE',
      unavailable: availability.unavailable, // [{ productId, reason }]
    });
    return;
  }

  const totals = await computeCartTotals(Number(u.id));
  if (totals.empty || totals.totalCents <= 0) {
    res.status(400).json({ error: 'Cart is empty' });
    return;
  }

  // Platform fee (8% + $0.75) — snapshot here; persisted on Order
  const pct = Number(Commission.globalPct ?? 0.08);
  const minFee = Number(Commission.minFeeCents ?? 75);
  const platformFeeCents = Math.max(Math.round(totals.subtotalCents * pct), minFee);

  const currency = String(process.env.CURRENCY ?? 'usd').toLowerCase();

  // Idempotency across client retries
  const idempotencyKey = `checkout:${String((req as any).id ?? '')}:${String(u.id)}`;

  const meta = {
    userId: String(u.id),
    itemCount: String(totals.itemCount),
    subtotalCents: String(totals.subtotalCents),
    shippingCents: String(totals.shippingCents),
    platformFeeCents: String(platformFeeCents),
    shippingVendors: Object.keys(totals.vendorShippingSnapshot).join(','), // quick debug
  };

  const result = await createPaymentIntent({
    amountCents: totals.totalCents,
    currency,
    metadata: meta,
    idempotencyKey,
  });

  // union narrowing before touching error
  if (!result.ok) {
    res
      .status(503)
      .json({ error: result.error || 'Failed to create PaymentIntent' });
    return;
  }
  const { clientSecret, intentId } = result;
  if (!clientSecret) {
    res.status(503).json({ error: 'Failed to create PaymentIntent' });
    return;
  }

  // ✅ Observability: record that we created a PI for this checkout (cart scoped by user)
  obs.checkoutIntentCreated(req, Number(u.id), totals.totalCents);

  const sequelize = db.instance();
  if (!sequelize) {
    res.status(500).json({ error: 'DB not initialized' });
    return;
  }

  // ✅ NEW: compute per-line commission allocation BEFORE writing items
  const lineTotals = totals.lines.map((l) => Number(l.lineTotalCents) || 0);
  const perLineFees = allocateProRataCents(lineTotals, platformFeeCents);
  const feeByProductId = new Map<number, number>();
  totals.lines.forEach((l, i) => {
    feeByProductId.set(Number(l.productId), perLineFees[i] || 0);
  });

  // Create (or no-op if already exists) the pending order + items
  await sequelize.transaction(async (t) => {
    if (intentId) {
      const exists = await Order.findOne({
        where: { paymentIntentId: intentId },
        transaction: t,
      });
      if (exists) {
        return;
      }
    }

    const order = await Order.create(
      {
        buyerUserId: Number(u.id),
        status: 'pending_payment',
        paymentIntentId: intentId ?? null,
        subtotalCents: totals.subtotalCents,
        shippingCents: totals.shippingCents,
        totalCents: totals.totalCents,
        commissionPct: pct,
        commissionCents: platformFeeCents,
        // ✅ snapshot of per-vendor rule + params + computed cents
        vendorShippingJson: totals.vendorShippingSnapshot,
      },
      { transaction: t }
    );

    // ✅ Observability: order persisted
    obs.orderCreated(req, Number(order.id), { totalCents: totals.totalCents });

    for (const l of totals.lines) {
      const commissionCents = feeByProductId.get(Number(l.productId)) ?? 0;
      await OrderItem.create(
        {
          orderId: Number(order.id),
          productId: Number(l.productId),
          vendorId: Number(l.vendorId),
          title: String(l.title),
          unitPriceCents: Number(l.unitPriceCents),
          quantity: Number(l.quantity),
          lineTotalCents: Number(l.lineTotalCents),

          // ✅ NEW: per-item commission snapshot
          commissionPct: pct,
          commissionCents,
        },
        { transaction: t }
      );
    }
  });

  res.json({ clientSecret });
}
