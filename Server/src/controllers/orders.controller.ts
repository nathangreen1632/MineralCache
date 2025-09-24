// Server/src/controllers/orders.controller.ts
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Order } from '../models/order.model.js';
import { OrderItem } from '../models/orderItem.model.js';

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
      commissionPct: Number(order.commissionPct),
      commissionCents: Number(order.commissionCents),
      vendorShipping: order.vendorShippingJson || {},
      items: items.map((i) => ({
        productId: Number(i.productId),
        vendorId: Number(i.vendorId),
        title: String(i.title),
        unitPriceCents: Number(i.unitPriceCents),
        quantity: Number(i.quantity),
        lineTotalCents: Number(i.lineTotalCents),
      })),
    },
  });
}

export async function markShipped(_req: Request, res: Response): Promise<void> {
  // TODO: future enhancement when we add fulfillment states
  res.json({ ok: true });
}
export async function markDelivered(_req: Request, res: Response): Promise<void> {
  // TODO: future enhancement when we add fulfillment states
  res.json({ ok: true });
}
