// Server/src/controllers/orders.controller.ts
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Order } from '../models/order.model.js';
import { OrderItem } from '../models/orderItem.model.js';

// NEW: email + buyer fetch
import { User } from '../models/user.model.js';
import { sendOrderEmail } from '../services/email.service.js';

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

// PATCH /api/orders/:id/ship
export async function markShipped(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const body = req.body as {
    carrier?: string;
    tracking?: string;
    itemIds?: number[]; // optional: limit to specific items; default = all in order
  };

  const order = await Order.findByPk(id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  if (order.status !== 'paid') {
    res.status(400).json({ error: 'Only paid orders can be shipped' });
    return;
  }

  const where: any = { orderId: order.id };
  if (Array.isArray(body.itemIds) && body.itemIds.length > 0) {
    where.id = { [Op.in]: body.itemIds };
  }

  const now = new Date();
  await OrderItem.update(
    {
      shipCarrier: body.carrier ?? null,
      shipTracking: body.tracking ?? null,
      shippedAt: now,
    },
    { where }
  );

  // Email buyer
  const buyer = await User.findByPk((order as any).buyerUserId);
  if (buyer?.email) {
    const orderItems = await OrderItem.findAll({ where: { orderId: order.id } });

    const lines: string[] = [];
    for (const i of orderItems) {
      const qty = i.quantity;
      let fragment = `• ${i.title} ×${qty}`;
      const trk = (i as any).shipTracking;
      if (trk) {
        fragment += ` (tracking: ${trk})`;
      }
      lines.push(fragment);
    }
    const itemsBrief = lines.join('<br/>');

    let trackingUrl: string | null = null;
    if (body.tracking) {
      const carrier = (body.carrier || '').toLowerCase();
      if (carrier === 'ups') {
        trackingUrl = `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(body.tracking)}`;
      } else if (carrier === 'usps') {
        trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(body.tracking)}`;
      } else if (carrier === 'fedex') {
        trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(body.tracking)}`;
      } else {
        trackingUrl = null;
      }
    }

    const orderNumber = readOrderNumberSafe(order);
    await sendOrderEmail('order_shipped', {
      orderId: Number(order.id),
      orderNumber,
      buyer: { email: buyer.email, name: (buyer as any)?.fullName ?? null },
      itemsBrief,
      carrier: body.carrier ?? null,
      trackingUrl,
    });
  }

  res.json({ ok: true });
}

// PATCH /api/orders/:id/deliver
export async function markDelivered(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const body = req.body as { itemIds?: number[] };

  const order = await Order.findByPk(id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  const where: any = { orderId: order.id };
  if (Array.isArray(body.itemIds) && body.itemIds.length > 0) {
    where.id = { [Op.in]: body.itemIds };
  }

  const now = new Date();
  await OrderItem.update({ deliveredAt: now }, { where });

  // Email buyer
  const buyer = await User.findByPk((order as any).buyerUserId);
  if (buyer?.email) {
    const orderItems = await OrderItem.findAll({ where: { orderId: order.id } });
    const itemsBrief = orderItems.map(i => `• ${i.title}`).join('<br/>');

    const orderNumber = readOrderNumberSafe(order);
    await sendOrderEmail('order_delivered', {
      orderId: Number(order.id),
      orderNumber,
      buyer: { email: buyer.email, name: (buyer as any)?.fullName ?? null },
      itemsBrief,
    });
  }

  res.json({ ok: true });
}

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
