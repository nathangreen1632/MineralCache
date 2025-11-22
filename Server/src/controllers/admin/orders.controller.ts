import type { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { Order } from '../../models/order.model.js';
import { OrderItem } from '../../models/orderItem.model.js';
import { Vendor } from '../../models/vendor.model.js';
import {
  adminListOrdersSchema,
  adminOrderIdParamSchema,
} from '../../validation/adminOrders.schema.js';
import { User } from '../../models/user.model.js';
import { buildAdminOrdersCsv } from '../../services/admin/adminOrdersCsv.service.js';
import { db } from '../../models/sequelize.js';
import { createRefund } from '../../services/stripe.service.js';
import { z, type ZodError } from 'zod';

type ListOrderItemPlain = {
  vendorId: number;
  quantity: number;
};

type ListOrderPlain = {
  id: number;
  createdAt: Date;
  status: string;
  buyerUserId: number | null;
  shippingName?: string | null;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  items?: ListOrderItemPlain[];
};

type AdminOrderDetailItem = {
  productId: number;
  vendorId: number;
  vendorName?: string | null;
  title: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  shipCarrier?: string | null;
  shipTracking?: string | null;
  shippedAt?: Date | string | null;
  deliveredAt?: Date | string | null;
};

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

function toDateBound(s?: string, endOfDay = false): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

export async function listAdminOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = adminListOrdersSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query', details: zDetails(parsed.error) });
      return;
    }

    const {
      page = 1,
      pageSize = 25,
      status,
      vendorId,
      buyerId,
      paymentIntentId,
      dateFrom,
      dateTo,
      sort,
    } = parsed.data;

    const where: any = {};
    if (status) where.status = status;
    if (buyerId) where.buyerUserId = buyerId;
    if (paymentIntentId) where.paymentIntentId = paymentIntentId;

    const start = toDateBound(dateFrom, false);
    const end = toDateBound(dateTo, true);
    if (start && end) where.createdAt = { [Op.between]: [start, end] };
    else if (start) where.createdAt = { [Op.gte]: start };
    else if (end) where.createdAt = { [Op.lte]: end };

    if (vendorId) {
      const rows = await OrderItem.findAll({
        where: { vendorId },
        attributes: ['orderId'],
        group: ['orderId'],
      });
      const ids = rows.map((r: any) => Number(r.orderId)).filter((n) => Number.isFinite(n));
      if (ids.length === 0) {
        res.json({ items: [], total: 0, page, pageSize, totalPages: 0 });
        return;
      }
      where.id = { [Op.in]: ids };
    }

    let orderClause: any[] = [['createdAt', 'DESC'], ['id', 'DESC']];
    if (sort === 'oldest') orderClause = [['createdAt', 'ASC'], ['id', 'ASC']];
    else if (sort === 'amount_desc') orderClause = [['totalCents', 'DESC'], ['id', 'DESC']];
    else if (sort === 'amount_asc') orderClause = [['totalCents', 'ASC'], ['id', 'ASC']];

    const offset = (page - 1) * pageSize;

    const { rows, count } = await Order.findAndCountAll({
      where,
      order: orderClause as any,
      offset,
      limit: pageSize,
      distinct: true,
      include: [
        {
          model: OrderItem,
          as: 'items',
          attributes: [
            'id',
            'orderId',
            'productId',
            'vendorId',
            'title',
            'unitPriceCents',
            'quantity',
            'lineTotalCents',
          ],
        },
      ],
    });

    const orders: ListOrderPlain[] = rows.map((r) => r.toJSON() as ListOrderPlain);

    const buyerIds = Array.from(
      new Set(
        orders
          .map((o) => Number(o.buyerUserId ?? 0))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    );

    const buyers = buyerIds.length
      ? await User.findAll({
        where: { id: { [Op.in]: buyerIds } },
        attributes: ['id', 'email'],
        raw: true,
      })
      : [];

    const emailById = new Map<number, string>();
    for (const b of buyers as any[]) {
      emailById.set(Number(b.id), String(b.email ?? ''));
    }

    const allVendorIds = new Set<number>();
    for (const o of orders) {
      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        const vid = Number(it.vendorId);
        if (Number.isFinite(vid)) allVendorIds.add(vid);
      }
    }

    const vendorIds = Array.from(allVendorIds);
    const vendors = vendorIds.length
      ? await Vendor.findAll({
        where: { id: { [Op.in]: vendorIds } },
        attributes: ['id', 'slug'],
        raw: true,
      })
      : [];

    const vendorSlugById = new Map<number, string>();
    for (const v of vendors as any[]) {
      vendorSlugById.set(Number(v.id), String(v.slug ?? ''));
    }

    const totalPages = Math.max(1, Math.ceil(count / pageSize));

    res.json({
      items: orders.map((o) => {
        const items = Array.isArray(o.items) ? o.items : [];
        const itemCount = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

        const vendorIdsForOrder = new Set<number>();
        for (const it of items) {
          const vid = Number(it.vendorId);
          if (Number.isFinite(vid)) vendorIdsForOrder.add(vid);
        }
        const vendorSlugs = Array.from(vendorIdsForOrder)
          .map((id) => vendorSlugById.get(id))
          .filter((s): s is string => Boolean(s));

        return {
          id: Number(o.id),
          createdAt: o.createdAt,
          status: o.status,
          buyerId: Number(o.buyerUserId),
          buyerName: o.shippingName ?? null,
          buyerEmail: emailById.get(Number(o.buyerUserId ?? 0)) ?? null,
          itemCount,
          vendorCount: vendorIdsForOrder.size,
          vendorSlugs,
          subtotalCents: Number(o.subtotalCents),
          shippingCents: Number(o.shippingCents),
          totalCents: Number(o.totalCents),
        };
      }),
      total: count,
      page,
      pageSize,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = adminOrderIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid order id', details: zDetails(parsed.error) });
      return;
    }

    const id = Number(parsed.data.id);

    const order = await Order.findByPk(id);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const items = await OrderItem.findAll({ where: { orderId: id } });

    const vendorIds = Array.from(
      new Set(
        items
          .map((i) => Number(i.vendorId))
          .filter((n) => Number.isFinite(n)),
      ),
    );

    const vendors = vendorIds.length
      ? await Vendor.findAll({
        where: { id: { [Op.in]: vendorIds } },
        attributes: ['id', 'slug', 'displayName'],
      })
      : [];

    const vendorById = new Map<number, { slug?: string | null; displayName?: string | null }>();
    for (const v of vendors as any[]) {
      vendorById.set(Number(v.id), {
        slug: v.slug ?? null,
        displayName: v.displayName ?? null,
      });
    }

    const vendorTotals = new Map<number, number>();
    for (const i of items as any[]) {
      const vid = Number(i.vendorId);
      if (!Number.isFinite(vid)) continue;
      const prev = vendorTotals.get(vid) ?? 0;
      vendorTotals.set(vid, prev + Number(i.lineTotalCents));
    }

    const detailItems: AdminOrderDetailItem[] = items.map((i) => {
      const v = vendorById.get(Number(i.vendorId));
      return {
        productId: Number(i.productId),
        vendorId: Number(i.vendorId),
        vendorName: v?.displayName ?? v?.slug ?? null,
        title: String(i.title),
        unitPriceCents: Number(i.unitPriceCents),
        quantity: Number(i.quantity),
        lineTotalCents: Number(i.lineTotalCents),
        shipCarrier: (i as any).shipCarrier ?? null,
        shipTracking: (i as any).shipTracking ?? null,
        shippedAt: (i as any).shippedAt ?? null,
        deliveredAt: (i as any).deliveredAt ?? null,
      };
    });

    res.json({
      item: {
        id: Number(order.id),
        createdAt: order.createdAt,
        status: (order as any).status,
        buyerId: Number((order as any).buyerUserId),
        buyerName: (order as any).shippingName ?? null,
        subtotalCents: Number((order as any).subtotalCents),
        shippingCents: Number((order as any).shippingCents),
        totalCents: Number((order as any).totalCents),
        commissionCents: Number((order as any).commissionCents ?? 0),
        commissionPct: Number((order as any).commissionPct ?? 0),
        paymentIntentId: (order as any).paymentIntentId ?? null,
        vendors: vendorIds.map((vid) => {
          const v = vendorById.get(vid);
          return {
            vendorId: vid,
            displayName: v?.displayName ?? v?.slug ?? null,
            vendorTotalCents: vendorTotals.get(vid) ?? 0,
          };
        }),
        items: detailItems,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function buildAdminOrdersFilter(parsedData: any) {
  const {
    status,
    vendorId,
    buyerId,
    paymentIntentId,
    dateFrom,
    dateTo,
    from,
    to,
  } = parsedData ?? {};

  const where: any = {};
  if (status) where.status = status;
  if (buyerId) where.buyerUserId = buyerId;
  if (paymentIntentId) where.paymentIntentId = paymentIntentId;

  const start = toDateBound(dateFrom ?? from, false);
  const end = toDateBound(dateTo ?? to, true);
  if (start && end) where.createdAt = { [Op.between]: [start, end] };
  else if (start) where.createdAt = { [Op.gte]: start };
  else if (end) where.createdAt = { [Op.lte]: end };

  if (vendorId) {
    const rows = await OrderItem.findAll({
      where: { vendorId },
      attributes: ['orderId'],
      group: ['orderId'],
      raw: true,
    });
    const ids = rows.map((r: any) => Number(r.orderId)).filter((n) => Number.isFinite(n));
    if (ids.length === 0) return { where: { id: { [Op.in]: [-1] } }, filteredOrderIds: [] as number[] };
    where.id = { [Op.in]: ids };
    return { where, filteredOrderIds: ids };
  }

  return { where, filteredOrderIds: null as number[] | null };
}

export async function exportAdminOrdersCsv(req: Request, res: Response): Promise<void> {
  const parsed = adminListOrdersSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: zDetails(parsed.error) });
    return;
  }

  const { where } = await buildAdminOrdersFilter(parsed.data);

  const sort = parsed.data.sort as string | undefined;
  let orderClause: any[] = [['createdAt', 'DESC'], ['id', 'DESC']];
  if (sort === 'oldest') orderClause = [['createdAt', 'ASC'], ['id', 'ASC']];
  else if (sort === 'amount_desc') orderClause = [['totalCents', 'DESC'], ['id', 'DESC']];
  else if (sort === 'amount_asc') orderClause = [['totalCents', 'ASC'], ['id', 'ASC']];

  const HARD_CAP = 5000;

  const orders = await Order.findAll({
    where,
    order: orderClause as any,
    attributes: [
      'id',
      'createdAt',
      'updatedAt',
      'paidAt',
      'failedAt',
      'refundedAt',
      'status',
      'buyerUserId',
      'subtotalCents',
      'shippingCents',
      'taxCents',
      'totalCents',
      'paymentIntentId',
    ],
    limit: HARD_CAP,
    raw: true,
  });

  if (orders.length === 0) {
    const empty = buildAdminOrdersCsv([], new Map(), new Map());
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="admin-orders.csv"');
    res.status(200).send('\uFEFF' + empty);
    return;
  }

  const orderIds = orders.map((o: any) => Number(o.id));
  const orderItems = await OrderItem.findAll({
    where: { orderId: { [Op.in]: orderIds } },
    attributes: [
      'id',
      'orderId',
      'vendorId',
      'title',
      'unitPriceCents',
      'quantity',
      'lineTotalCents',
    ],
    raw: true,
  });

  const byOrderId = new Map<number, any[]>();
  for (const it of orderItems as any[]) {
    const oid = Number(it.orderId);
    const cur = byOrderId.get(oid) ?? [];
    cur.push(it);
    byOrderId.set(oid, cur);
  }

  const buyerIds = Array.from(
    new Set(
      orders
        .map((o: any) => Number(o.buyerUserId ?? 0))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  );
  const buyers = buyerIds.length
    ? await User.findAll({ where: { id: { [Op.in]: buyerIds } }, attributes: ['id', 'email'], raw: true })
    : [];

  const emailById = new Map<number, string>();
  for (const b of buyers as any[]) {
    emailById.set(Number(b.id), String(b.email ?? ''));
  }

  const csv = buildAdminOrdersCsv(orders as any[], byOrderId as any, emailById);

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="admin-orders-${stamp}.csv"`);
  res.status(200).send('\uFEFF' + csv);
}

function hasFn(obj: any, key: string): obj is Record<string, any> {
  return obj && typeof obj[key] === 'function';
}

export async function refundOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'Bad id' });
      return;
    }

    const sequelize = db.instance();
    if (!sequelize) {
      res.status(500).json({ error: 'DB not initialized' });
      return;
    }

    const order = await Order.findByPk(id);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if ((order as any).status !== 'paid') {
      res.status(400).json({ error: 'Only paid orders can be refunded' });
      return;
    }

    const intentId: string | null =
      (order as any).paymentIntentId ??
      (hasFn(order, 'get') ? (order as any).get('paymentIntentId') : null) ??
      null;

    if (!intentId) {
      res.status(400).json({ error: 'Order missing paymentIntentId' });
      return;
    }

    const r = await createRefund({ paymentIntentId: intentId, reason: 'requested_by_customer' });
    if (!r.ok) {
      res.status(502).json({ error: r.error || 'Failed to create refund' });
      return;
    }

    await sequelize.transaction(async (t) => {
      (order as any).status = 'refunded';
      (order as any).refundedAt = new Date();
      await order.save({ transaction: t });
    });

    try {
      const { obs } = await import('../../services/observability.service.js');
      if (typeof (obs as any)?.orderRefunded === 'function') {
        (obs as any).orderRefunded(req, Number(order.id), { refundId: (r as any).refundId });
      }
    } catch {}

    res.json({ ok: true, refundId: (r as any).refundId });
  } catch (err) {
    next(err);
  }
}
