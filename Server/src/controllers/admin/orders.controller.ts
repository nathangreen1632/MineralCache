// Server/src/controllers/admin/orders.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { Order } from '../../models/order.model.js';
import { OrderItem } from '../../models/orderItem.model.js';
import {
  adminListOrdersSchema,
  adminOrderIdParamSchema,
} from '../../validation/adminOrders.schema.js';

// ✅ CSV export support
import { User } from '../../models/user.model.js';
import { buildAdminOrdersCsv } from '../../services/admin/adminOrdersCsv.service.js';

// ✅ Refunds
import { db } from '../../models/sequelize.js';
import { createRefund } from '../../services/stripe.service.js';
import { z, type ZodError } from 'zod';

// ---- minimal, non-deprecated Zod error serializer
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

/* ----------------------------- Admin: List ------------------------------ */

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

    // Date range on createdAt
    const start = toDateBound(dateFrom, false);
    const end = toDateBound(dateTo, true);
    if (start && end) where.createdAt = { [Op.between]: [start, end] };
    else if (start) where.createdAt = { [Op.gte]: start };
    else if (end) where.createdAt = { [Op.lte]: end };

    // Optional vendor filter: orders that contain at least one item for that vendor
    if (vendorId) {
      const rows = await OrderItem.findAll({
        where: { vendorId },
        attributes: ['orderId'],
        group: ['orderId'],
      });
      const ids = rows.map((r: any) => Number(r.orderId)).filter((n) => Number.isFinite(n));
      if (ids.length === 0) {
        res.json({ items: [], total: 0, page, pageSize });
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

    res.json({
      items: rows,
      total: count,
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
}

/* ---------------------------- Admin: Get One ---------------------------- */

export async function getAdminOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = adminOrderIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid order id', details: zDetails(parsed.error) });
      return;
    }

    const order = await Order.findByPk(parsed.data.id, {
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

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.json(order);
  } catch (err) {
    next(err);
  }
}

/* ------------------------- Admin: Export Orders CSV --------------------- */

/** Build WHERE + optional vendor filter, mirroring listAdminOrders. Supports alias keys `from`/`to`. */
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

  // Optional vendor filter: include only orders that contain at least one item for that vendor
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

/**
 * GET /api/admin/orders.csv
 * Exports orders that match the current filter set as CSV (unpaginated, capped).
 */
export async function exportAdminOrdersCsv(req: Request, res: Response): Promise<void> {
  // Query validation (same schema as listing; router also uses validateQuery)
  const parsed = adminListOrdersSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: zDetails(parsed.error) });
    return;
  }

  // WHERE (with vendor filter if provided)
  const { where } = await buildAdminOrdersFilter(parsed.data);

  // Sort: mirror list defaults; allow newest/oldest/amount
  const sort = parsed.data.sort as string | undefined;
  let orderClause: any[] = [['createdAt', 'DESC'], ['id', 'DESC']]; // newest
  if (sort === 'oldest') orderClause = [['createdAt', 'ASC'], ['id', 'ASC']];
  else if (sort === 'amount_desc') orderClause = [['totalCents', 'DESC'], ['id', 'DESC']];
  else if (sort === 'amount_asc') orderClause = [['totalCents', 'ASC'], ['id', 'ASC']];

  const HARD_CAP = 5000;

  // Fetch orders (explicit attributes that exist per ERD; note: no buyerName column)
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

  // If nothing to export, send header row only
  if (orders.length === 0) {
    const empty = buildAdminOrdersCsv([], new Map(), new Map());
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="admin-orders.csv"');
    res.status(200).send('\uFEFF' + empty);
    return;
  }

  // Fetch items for these orders to compute counts/vendor sets inside the CSV service
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

  // index items by orderId
  const byOrderId = new Map<number, any[]>();
  for (const it of orderItems as any[]) {
    const oid = Number(it.orderId);
    const cur = byOrderId.get(oid) ?? [];
    cur.push(it);
    byOrderId.set(oid, cur);
  }

  // Pull buyer emails (optional enrichment)
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

  // Build CSV body
  const csv = buildAdminOrdersCsv(orders as any[], byOrderId as any, emailById);

  // Send (with UTF-8 BOM for Excel)
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="admin-orders-${stamp}.csv"`);
  res.status(200).send('\uFEFF' + csv);
}

/* ---------------------------- Admin: Refund ------------------------------ */

function hasFn(obj: any, key: string): obj is Record<string, any> {
  return obj && typeof obj[key] === 'function';
}

/** POST /api/admin/orders/:id/refund  (full refunds only) */
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

    // Only paid orders can be refunded (skip already-refunded)
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

    // Create full refund at Stripe
    const r = await createRefund({ paymentIntentId: intentId, reason: 'requested_by_customer' });
    if (!r.ok) {
      res.status(502).json({ error: r.error || 'Failed to create refund' });
      return;
    }

    // Persist refund status atomically
    await sequelize.transaction(async (t) => {
      (order as any).status = 'refunded';
      (order as any).refundedAt = new Date();
      await order.save({ transaction: t });
    });

    // Optional observability if present
    try {
      const { obs } = await import('../../services/observability.service.js');
      if (typeof (obs as any)?.orderRefunded === 'function') {
        (obs as any).orderRefunded(req, Number(order.id), { refundId: (r as any).refundId });
      }
    } catch {
      // ignore
    }

    res.json({ ok: true, refundId: (r as any).refundId });
  } catch (err) {
    next(err);
  }
}
