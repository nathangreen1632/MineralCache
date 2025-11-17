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
import { obs } from '../services/observability.service.js';
import { getAdminSettingsCached } from '../services/settings.service.js';
import { calcTaxCents } from '../services/tax.service.js';
import { AuctionLock } from '../models/auctionLock.model.js';

function allocateProRataCents(lineTotals: number[], totalFeeCents: number): number[] {
  const n = lineTotals.length;
  if (totalFeeCents <= 0 || n === 0) return Array(n).fill(0);
  const subtotal = lineTotals.reduce((a, b) => a + Math.max(0, Number(b) || 0), 0);
  if (subtotal <= 0) return Array(n).fill(0);
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

async function computeCartTotals(userId: number) {
  const cart = await Cart.findOne({ where: { userId } });
  if (!cart) {
    return {
      empty: true as const,
      subtotalCents: 0,
      shippingCents: 0,
      taxCents: 0,
      totalCents: 0,
      itemCount: 0,
      lines: [] as any[],
      vendorShippingSnapshot: {} as Record<string, any>,
    };
  }
  const items: Array<{ productId: number; quantity: number }> = Array.isArray((cart as any).itemsJson)
    ? (cart as any).itemsJson
    : [];
  if (items.length === 0) {
    return {
      empty: true as const,
      subtotalCents: 0,
      shippingCents: 0,
      taxCents: 0,
      totalCents: 0,
      itemCount: 0,
      lines: [] as any[],
      vendorShippingSnapshot: {} as Record<string, any>,
    };
  }
  const ids = [...new Set(items.map((i) => Number(i.productId)))].filter((n) => Number.isFinite(n));
  if (ids.length === 0) {
    return {
      empty: true as const,
      subtotalCents: 0,
      shippingCents: 0,
      taxCents: 0,
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
  const locks = await AuctionLock.findAll({
    where: { productId: { [Op.in]: ids }, status: 'active', userId },
    attributes: ['productId', 'priceCents', 'expiresAt'],
  });
  const now = new Date();
  const lockMap = new Map<number, { priceCents: number; expiresAt: Date }>();
  for (const l of locks) {
    const exp = new Date(String(l.expiresAt));
    if (exp > now) lockMap.set(Number(l.productId), { priceCents: Number(l.priceCents), expiresAt: exp });
  }
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
  const vendorGroups = new Map<number, Array<{ product: Product; quantity: number }>>();
  for (const it of items) {
    const qty = Number(it.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const p = byId.get(Number(it.productId));
    if (!p) continue;
    const lock = lockMap.get(Number(it.productId));
    let unitPrice = 0;
    if (lock) {
      unitPrice = Number(lock.priceCents);
    } else {
      try {
        // @ts-ignore
        unitPrice =
          typeof (p as any).getEffectivePriceCents === 'function'
            ? Number((p as any).getEffectivePriceCents())
            : Number((p as any).priceCents || 0);
      } catch {
        unitPrice = Number((p as any).priceCents || 0);
      }
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
  const taxCents = calcTaxCents(subtotalCents, taxRateBps);
  const totalCents = subtotalCents + shippingCents + taxCents;
  return {
    empty: totalCents <= 0 ? (true as const) : (false as const),
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents,
    itemCount,
    lines,
    vendorShippingSnapshot,
  };
}

export async function createCheckoutIntent(req: Request, res: Response): Promise<void> {
  const u = (req as any).user ?? (req.session as any)?.user ?? null;
  if (!u?.id) {
    res
      .status(401)
      .json({ error: 'Please sign in or create a MineralCache account to complete checkout.' });
    return;
  }
  if (!u.dobVerified18) {
    res
      .status(403)
      .json({ error: 'Age verification required', code: 'AGE_VERIFICATION_REQUIRED' });
    return;
  }

  const body = req.body ?? {};
  const shipping = body.shipping ?? {};

  const shippingName = typeof shipping.name === 'string' ? shipping.name.trim() : '';
  const shippingEmail = typeof shipping.email === 'string' ? shipping.email.trim() : '';
  const shippingPhone = typeof shipping.phone === 'string' ? shipping.phone.trim() : '';
  const shippingAddress1 =
    typeof shipping.address1 === 'string' ? shipping.address1.trim() : '';
  const shippingAddress2 =
    typeof shipping.address2 === 'string' ? shipping.address2.trim() : '';
  const shippingCity = typeof shipping.city === 'string' ? shipping.city.trim() : '';
  const shippingState = typeof shipping.state === 'string' ? shipping.state.trim() : '';
  const shippingPostal =
    typeof shipping.postal === 'string' ? shipping.postal.trim() : '';
  const shippingCountry =
    typeof shipping.country === 'string' ? shipping.country.trim().toUpperCase() : '';

  if (
    !shippingName ||
    !shippingAddress1 ||
    !shippingCity ||
    !shippingState ||
    !shippingPostal ||
    !shippingCountry
  ) {
    res.status(400).json({ error: 'Missing required shipping fields' });
    return;
  }

  const shippingForStripe = {
    name: shippingName,
    address: {
      line1: shippingAddress1,
      line2: shippingAddress2 || undefined,
      city: shippingCity,
      state: shippingState,
      postal_code: shippingPostal,
      country: shippingCountry,
    },
    phone: shippingPhone || undefined,
  };

  const cartForGuard = await Cart.findOne({ where: { userId: Number(u.id) } });
  const cartItemsForGuard: Array<{ productId: number; quantity: number }> = Array.isArray(
    (cartForGuard as any)?.itemsJson
  )
    ? ((cartForGuard as any).itemsJson as Array<{ productId: number; quantity: number }>)
    : [];
  const productIds = cartItemsForGuard
    .map((x) => Number((x as any)?.productId))
    .filter((n) => Number.isFinite(n));
  const availability = await validateAvailability(productIds, Number(u.id));
  if (!availability.ok) {
    res.status(409).json({
      error: 'Some items are no longer available',
      code: 'PRODUCT_UNAVAILABLE',
      unavailable: availability.unavailable,
    });
    return;
  }
  const totals = await computeCartTotals(Number(u.id));
  if (totals.empty || totals.totalCents <= 0) {
    res.status(400).json({ error: 'Cart is empty' });
    return;
  }
  const pct = Number(Commission.globalPct ?? 0.08);
  const minFee = Number(Commission.minFeeCents ?? 75);
  const platformFeeCents = Math.max(Math.round(totals.subtotalCents * pct), minFee);
  const currency = String(process.env.CURRENCY ?? 'usd').toLowerCase();
  const idempotencyKey = `checkout:${String((req as any).id ?? '')}:${String(u.id)}`;
  const meta = {
    userId: String(u.id),
    itemCount: String(totals.itemCount),
    subtotalCents: String(totals.subtotalCents),
    shippingCents: String(totals.shippingCents),
    taxCents: String(totals.taxCents),
    platformFeeCents: String(platformFeeCents),
    shippingVendors: Object.keys(totals.vendorShippingSnapshot).join(','),
  };
  const result = await createPaymentIntent({
    amountCents: totals.totalCents,
    currency,
    metadata: meta,
    idempotencyKey,
    shipping: shippingForStripe,
  });
  if (!result.ok) {
    res.status(503).json({ error: result.error || 'Failed to create PaymentIntent' });
    return;
  }
  const { clientSecret, intentId } = result;
  if (!clientSecret) {
    res.status(503).json({ error: 'Failed to create PaymentIntent' });
    return;
  }
  obs.checkoutIntentCreated(req, Number(u.id), totals.totalCents);
  const sequelize = db.instance();
  if (!sequelize) {
    res.status(500).json({ error: 'DB not initialized' });
    return;
  }
  const lineTotals = totals.lines.map((l) => Number(l.lineTotalCents) || 0);
  const perLineFees = allocateProRataCents(lineTotals, platformFeeCents);
  const feeByProductId = new Map<number, number>();
  totals.lines.forEach((l, i) => {
    feeByProductId.set(Number(l.productId), perLineFees[i] || 0);
  });
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
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        commissionPct: pct,
        commissionCents: platformFeeCents,
        vendorShippingJson: totals.vendorShippingSnapshot,
        shippingName,
        shippingEmail,
        shippingPhone,
        shippingAddress1,
        shippingAddress2,
        shippingCity,
        shippingState,
        shippingPostal,
        shippingCountry,
      },
      { transaction: t }
    );
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
          commissionPct: pct,
          commissionCents,
        },
        { transaction: t }
      );
    }
  });
  res.json({
    clientSecret,
    amountCents: totals.totalCents,
    totals: {
      subtotal: totals.subtotalCents,
      shipping: totals.shippingCents,
      tax: totals.taxCents,
      total: totals.totalCents,
    },
    vendorShippingSnapshot: totals.vendorShippingSnapshot,
  });
}

