// Server/src/controllers/orders.controller.ts
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Order } from '../models/order.model.js';
import { OrderItem } from '../models/orderItem.model.js';

// NEW: email + buyer fetch
import { User } from '../models/user.model.js';
import { sendOrderEmail } from '../services/email.service.js';

// ✅ NEW: cancel PI helper for buyer-initiated cancellations
import { cancelPaymentIntent } from '../services/stripe.service.js';

// ✅ NEW: validation + carrier helpers
import { shipOrderSchema, deliverOrderSchema } from '../validation/orders.schema.js';
import { normalizeCarrier, trackingUrl as buildTrackingUrl } from '../services/shipping.service.js';

function parsePage(v: unknown, def = 1) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.floor(n);
}
function parsePageSize(v: unknown, def = 20) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return def;
  return Math.floor(n);
}

// Helper: safe read of optional orderNumber (avoids TS2339)
function readOrderNumberSafe(order: any): string | null {
  const direct = order?.orderNumber;
  if (typeof direct === 'string' && direct.length > 0) return direct;

  if (typeof order?.get === 'function') {
    const camel = order.get('orderNumber');
    if (typeof camel === 'string' && camel.length > 0) return camel;
    const snake = order.get('order_number');
    if (typeof snake === 'string' && snake.length > 0) return snake;
  }
  return null;
}

/** Read auth from either {auth} or {user}/{vendor} */
function getAuth(req: Request): { userId: number | null; vendorId: number | null; isAdmin: boolean } {
  const auth = (req as any).auth as { userId?: number; vendorId?: number; role?: string } | undefined;
  const user = (req as any).user ?? (req.session as any)?.user ?? auth ?? null;
  const vendor = (req as any).vendor ?? null;

  const userId =
    (auth?.userId && Number.isFinite(auth.userId) && auth.userId) ||
    (user?.id && Number.isFinite(user.id) && user.id) ||
    null;

  const vendorId =
    (auth?.vendorId && Number.isFinite(auth.vendorId) && auth.vendorId) ||
    (vendor?.id && Number.isFinite(vendor.id) && vendor.id) ||
    null;

  const role = (user?.role ?? auth?.role ?? '').toString().toLowerCase();
  const isAdmin = role === 'admin' || role === 'superadmin' || role === 'owner';
  return { userId, vendorId, isAdmin };
}

export async function listMyOrders(req: Request, res: Response): Promise<void> {
  const u = (req as any).user ?? (req.session as any)?.user ?? null;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const page = parsePage((req.query as any)?.page, 1);
  const pageSize = parsePageSize((req.query as any)?.pageSize, 20);

  const { rows, count } = await Order.findAndCountAll({
    where: { buyerUserId: Number(u.id) },
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const ids = rows.map((r) => Number(r.id));
  const items =
    ids.length > 0
      ? await OrderItem.findAll({ where: { orderId: { [Op.in]: ids } } })
      : [];

  const byOrderId = new Map<number, OrderItem[]>();
  for (const it of items) {
    const k = Number(it.orderId);
    const cur = byOrderId.get(k) ?? [];
    cur.push(it);
    byOrderId.set(k, cur);
  }

  const out = rows.map((r) => ({
    id: Number(r.id),
    status: r.status,
    createdAt: r.createdAt,
    subtotalCents: r.subtotalCents,
    shippingCents: r.shippingCents,
    taxCents: Number((r as any).taxCents ?? 0), // ✅ NEW
    totalCents: r.totalCents,
    items: (byOrderId.get(Number(r.id)) ?? []).map((i) => ({
      productId: Number(i.productId),
      vendorId: Number(i.vendorId),
      title: String(i.title),
      unitPriceCents: Number(i.unitPriceCents),
      quantity: Number(i.quantity),
      lineTotalCents: Number(i.lineTotalCents),
      // Optional fulfillment fields (may be null)
      shipCarrier: (i as any).shipCarrier ?? null,
      shipTracking: (i as any).shipTracking ?? null,
      shippedAt: (i as any).shippedAt ?? null,
      deliveredAt: (i as any).deliveredAt ?? null,
    })),
  }));

  res.json({
    page,
    pageSize,
    total: count,
    items: out,
  });
}

export async function getOrder(req: Request, res: Response): Promise<void> {
  const u = (req as any).user ?? (req.session as any)?.user ?? null;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const id = Number((req.params as any)?.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'Bad id' });
    return;
  }

  const order = await Order.findOne({
    where: { id, buyerUserId: Number(u.id) },
  });
  if (!order) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const items = await OrderItem.findAll({ where: { orderId: id } });

  res.json({
    item: {
      id: Number(order.id),
      status: order.status,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      failedAt: order.failedAt,
      refundedAt: order.refundedAt,
      subtotalCents: order.subtotalCents,
      shippingCents: order.shippingCents,
      taxCents: Number((order as any).taxCents ?? 0), // ✅ NEW
      totalCents: order.totalCents,
      commissionPct: Number((order as any).commissionPct ?? 0),
      commissionCents: Number((order as any).commissionCents ?? 0),
      vendorShipping: (order as any).vendorShippingJson || {},
      items: items.map((i) => ({
        productId: Number(i.productId),
        vendorId: Number(i.vendorId),
        title: String(i.title),
        unitPriceCents: Number(i.unitPriceCents),
        quantity: Number(i.quantity),
        lineTotalCents: Number(i.lineTotalCents),
        shipCarrier: (i as any).shipCarrier ?? null,
        shipTracking: (i as any).shipTracking ?? null,
        shippedAt: (i as any).shippedAt ?? null,
        deliveredAt: (i as any).deliveredAt ?? null,
      })),
    },
  });
}

/* -------------------------------------------------------------------------- */
/*  Fulfillment: Ship / Deliver with ACL + Validation                         */
/* -------------------------------------------------------------------------- */

// PATCH /api/orders/:id/ship
export async function markShipped(req: Request, res: Response): Promise<void> {
  const { userId, vendorId, isAdmin } = getAuth(req);
  if (!userId || (!isAdmin && !vendorId)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const orderId = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    res.status(400).json({ error: 'Bad order id' });
    return;
  }

  const parsed = shipOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }

  const carrier = normalizeCarrier(parsed.data.carrier);
  if (!carrier) {
    res.status(400).json({ error: 'Unsupported carrier' });
    return;
  }
  const tracking = parsed.data.tracking && parsed.data.tracking.trim() !== '' ? parsed.data.tracking.trim() : null;
  const itemFilterIds = parsed.data.itemIds && parsed.data.itemIds.length > 0 ? parsed.data.itemIds : null;

  const order = await Order.findByPk(orderId);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  if ((order as any).status !== 'paid') {
    res.status(400).json({ error: 'Only paid orders can be shipped' });
    return;
  }

  // Scope items by role: admin → all; vendor → only their lines; optional itemIds filter
  const where: any = { orderId };
  if (!isAdmin && vendorId) where.vendorId = vendorId;
  if (itemFilterIds) where.id = { [Op.in]: itemFilterIds };

  const items = await OrderItem.findAll({ where });
  if (items.length === 0) {
    res.status(403).json({ error: 'No matching items to ship for your role' });
    return;
  }

  const now = new Date();
  for (const it of items) {
    it.set('shipCarrier', carrier);
    it.set('shipTracking', tracking);
    it.set('shippedAt', now);
    await it.save();
  }

  // Flip order status → shipped only if *all* lines are shipped (across vendors)
  const allItems = await OrderItem.findAll({ where: { orderId } });
  const allShipped = allItems.every((i: any) => !!i.shippedAt);
  if (allShipped) {
    (order as any).status = 'shipped';
    await order.save();
  }

  // Email buyer (best-effort)
  try {
    const buyer = await User.findByPk((order as any).buyerUserId).catch(() => null);
    if (buyer?.email) {
      const orderItems = await OrderItem.findAll({ where: { orderId } });
      const lines: string[] = [];
      for (const i of orderItems) {
        const qty = (i as any).quantity ?? 1;
        let fragment = `• ${i.title} ×${qty}`;
        const trk = (i as any).shipTracking;
        if (trk) fragment += ` (tracking: ${trk})`;
        lines.push(fragment);
      }
      const itemsBrief = lines.join('<br/>');

      const emailTrackingUrl = buildTrackingUrl(carrier, tracking || null);
      const orderNumber = readOrderNumberSafe(order);

      await sendOrderEmail('order_shipped', {
        orderId: Number(order.id),
        orderNumber,
        buyer: { email: buyer.email, name: (buyer as any)?.fullName ?? null },
        itemsBrief,
        carrier,
        trackingUrl: emailTrackingUrl,
      });
    }
  } catch {
    /* ignore */
  }

  res.json({
    ok: true,
    updated: items.map((i) => Number(i.id)),
    orderStatus: (order as any).status,
  });
}

// PATCH /api/orders/:id/deliver
export async function markDelivered(req: Request, res: Response): Promise<void> {
  const { userId, vendorId, isAdmin } = getAuth(req);
  if (!userId || (!isAdmin && !vendorId)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const orderId = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    res.status(400).json({ error: 'Bad order id' });
    return;
  }

  const parsed = deliverOrderSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const itemFilterIds = parsed.data.itemIds && parsed.data.itemIds.length > 0 ? parsed.data.itemIds : null;

  const order = await Order.findByPk(orderId);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  const where: any = { orderId };
  if (!isAdmin && vendorId) where.vendorId = vendorId;
  if (itemFilterIds) where.id = { [Op.in]: itemFilterIds };

  const items = await OrderItem.findAll({ where });
  if (items.length === 0) {
    res.status(403).json({ error: 'No matching items to deliver for your role' });
    return;
  }

  const now = new Date();
  for (const it of items) {
    it.set('deliveredAt', now);
    await it.save();
  }

  // Flip order status → delivered only if *all* lines are delivered
  const allItems = await OrderItem.findAll({ where: { orderId } });
  const allDelivered = allItems.every((i: any) => !!i.deliveredAt);
  if (allDelivered) {
    (order as any).status = 'delivered';
    await order.save();
  }

  // Email buyer (best-effort)
  try {
    const buyer = await User.findByPk((order as any).buyerUserId).catch(() => null);
    if (buyer?.email) {
      const orderItems = await OrderItem.findAll({ where: { orderId } });
      const itemsBrief = orderItems.map((i) => `• ${i.title}`).join('<br/>');

      const orderNumber = readOrderNumberSafe(order);
      await sendOrderEmail('order_delivered', {
        orderId: Number(order.id),
        orderNumber,
        buyer: { email: buyer.email, name: (buyer as any)?.fullName ?? null },
        itemsBrief,
      });
    }
  } catch {
    /* ignore */
  }

  res.json({
    ok: true,
    updated: items.map((i) => Number(i.id)),
    orderStatus: (order as any).status,
  });
}

/* -------------------------------------------------------------------------- */
/*  Receipt + Buyer-initiated Cancel                                          */
/* -------------------------------------------------------------------------- */

// GET /api/orders/:id/receipt
export async function getReceiptHtml(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const order = await Order.findByPk(id);
  if (!order) {
    res.status(404).send('Not found');
    return;
  }
  const items = await OrderItem.findAll({ where: { orderId: order.id } });

  const rows = items
    .map((i) => {
      const qty = i.quantity;
      const unit = i.unitPriceCents;
      return `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${i.title}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${qty}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${(unit / 100).toFixed(2)}</td>
    </tr>`;
    })
    .join('');

  const totalCents = typeof (order as any).totalCents === 'number' ? (order as any).totalCents : 0;
  const total = totalCents / 100;

  // ✅ NEW: tax row if present
  const taxCents = Number((order as any).taxCents ?? 0);
  const taxHtml =
    taxCents > 0
      ? `<tr>
           <td></td>
           <td style="padding:8px;text-align:right">Tax</td>
           <td style="padding:8px;text-align:right">$${(taxCents / 100).toFixed(2)}</td>
         </tr>`
      : '';

  const orderNumber = readOrderNumberSafe(order);
  const orderNumText = orderNumber ? `#${orderNumber}` : `ID ${order.id}`;

  const html = `
    <!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>Receipt ${orderNumText}</title></head>
      <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
        <h1>Receipt ${orderNumText}</h1>
        <p>Date: ${new Date(order.createdAt).toLocaleString()}</p>
        <table style="border-collapse:collapse;width:100%;max-width:720px">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ccc">Item</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ccc">Qty</th>
              <th style="text-align:right;padding:8px;border-bottom:1px solid #ccc">Price</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            ${taxHtml}
            <tr>
              <td></td>
              <td style="padding:8px;text-align:right"><strong>Total</strong></td>
              <td style="padding:8px;text-align:right"><strong>$${total.toFixed(2)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}

// ✅ NEW: Buyer cancel (pre-payment)
// PATCH /api/orders/:id/cancel
export async function cancelPendingOrder(req: Request, res: Response): Promise<void> {
  const u = (req as any).user ?? (req.session as any)?.user ?? null;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'Bad id' });
    return;
  }

  const order = await Order.findOne({ where: { id, buyerUserId: Number(u.id) } });
  if (!order) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  if ((order as any).status !== 'pending_payment') {
    res.status(400).json({ error: 'Only pending orders can be canceled' });
    return;
  }

  const piId: string | null =
    (order as any).paymentIntentId ??
    (typeof (order as any).get === 'function' ? (order as any).get('paymentIntentId') : null);

  // Best-effort cancel the PI if possible; ignore failure (e.g., already succeeded)
  if (piId) {
    await cancelPaymentIntent(piId);
  }

  (order as any).status = 'cancelled';
  (order as any).failedAt = new Date();
  await order.save();

  try {
    const { obs } = await import('../services/observability.service.js');
    if (typeof (obs as any)?.orderCanceled === 'function') {
      (obs as any).orderCanceled(req, Number(order.id));
    }
  } catch {
    // ignore
  }

  res.json({ ok: true });
}
