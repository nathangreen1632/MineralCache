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

/** Server-side cart → totals + line expansion */
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

    lines.push({
      productId: Number(p.id),
      vendorId: Number((p as any).vendorId),
      title: String((p as any).title ?? ''),
      unitPriceCents: unitPrice,
      quantity: qty,
      lineTotalCents: lineTotal,
    });
  }

  // Per-vendor shipping snapshot (Week-3 shipping rules to be added later)
  const vendorShipping: Record<string, number> = {};
  for (const l of lines) {
    const key = String(l.vendorId);
    if (!Object.prototype.hasOwnProperty.call(vendorShipping, key)) {
      vendorShipping[key] = 0;
    }
  }
  const shippingCents = Object.values(vendorShipping).reduce((a, b) => a + b, 0);

  const totalCents = subtotalCents + shippingCents;

  return {
    empty: totalCents <= 0 ? (true as const) : (false as const),
    subtotalCents,
    shippingCents,
    totalCents,
    itemCount,
    lines,
    vendorShipping,
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
  };

  const result = await createPaymentIntent({
    amountCents: totals.totalCents,
    currency,
    metadata: meta,
    idempotencyKey,
  });

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

  const sequelize = db.instance();
  if (!sequelize) {
    res.status(500).json({ error: 'DB not initialized' });
    return;
  }

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
        vendorShippingJson: totals.vendorShipping,
      },
      { transaction: t }
    );

    for (const l of totals.lines) {
      await OrderItem.create(
        {
          orderId: Number(order.id),
          productId: Number(l.productId),
          vendorId: Number(l.vendorId),
          title: String(l.title),
          unitPriceCents: Number(l.unitPriceCents),
          quantity: Number(l.quantity),
          lineTotalCents: Number(l.lineTotalCents),
        },
        { transaction: t }
      );
    }
  });

  res.json({ clientSecret });
}
