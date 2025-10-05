// Server/src/controllers/admin/orders.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { Order } from '../../models/order.model.js';
import { OrderItem } from '../../models/orderItem.model.js';
import {
  adminListOrdersSchema,
  adminOrderIdParamSchema,
} from '../../validation/adminOrders.schema.js';

// ✅ NEW for CSV export
import { User } from '../../models/user.model.js';
import { buildAdminOrdersCsv } from '../../services/admin/adminOrdersCsv.service.js';

// ✅ NEW imports for refunds
import { db } from '../../models/sequelize.js';
import { createRefund } from '../../services/stripe.service.js';
import { z, type ZodError } from 'zod'; // <-- add z for serializer

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
      res.status(400).json({ error: 'Invalid query', details: zDetails(parsed.error) }); // ← no deprecated .flatten()
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
      distinct: true, // ensure count isn’t multiplied by include
      include: [
        {
          model: OrderItem,
          as: 'items', // ← must match alias in associations.ts
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
      res.status(400).json({ error: 'Invalid order id', details: zDetails(parsed.error) }); // ← no .flatten()
      return;
    }

    const order = await Order.findByPk(parsed.data.id, {
      include: [
        {
          model: OrderItem,
          as: 'items', // ← include alias here too
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

/* ---------------------------- Admin: Export CSV ------------------------- */

// small helpers for this handler
function parseDate(d?: string | string[] | null): Date | null {
  const v = typeof d === 'string' ? d.trim() : '';
  if (!v) return null;
  const dt = new Date(v);
  return Number.isFinite(dt.valueOf()) ? dt : null;
}
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function isAdminReq(req: Request): boolean {
  const auth = (req as any).user ?? (req as any).auth ?? null;
  const role = (auth?.role ?? '').toString().toLowerCase();
  return role === 'admin' || role === 'superadmin' || role === 'owner';
}

/**
 * GET /api/admin/orders.csv
 * Query params (optional):
 * - status: string ('paid','shipped','delivered','failed','refunded','cancelled','pending_payment' or 'all')
 * - vendorId: number (only orders containing at least one item from this vendor)
 * - from: YYYY-MM-DD
 * - to: YYYY-MM-DD
 * - sort: field (default 'createdAt')
 * - dir: 'asc' | 'desc' (default 'desc')
 * - limit: number (default 5000, max 25000)
 */
export async function exportCsv(req: Request, res: Response): Promise<void> {
  if (!isAdminReq(req)) {
    res.status(403).json({ ok: false, error: 'Admin only' });
    return;
  }

  const q = req.query as Record<string, string | undefined>;

  const status = q.status && q.status !== 'all' ? q.status : undefined;
  const vendorId = q.vendorId ? Number(q.vendorId) : undefined;

  const from = parseDate(q.from ?? undefined);
  const to = parseDate(q.to ?? undefined);

  const where: any = {};
  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt[Op.gte] = startOfDay(from);
    if (to) where.createdAt[Op.lte] = endOfDay(to);
  }

  const sort = (q.sort ?? 'createdAt').toString();
  const dir = (q.dir ?? 'desc').toString().toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const limitRaw = q.limit ? Number(q.limit) : 5000;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(25000, limitRaw)) : 5000;

  // If filtering by vendor, use an EXISTS include (attributes: []), then fetch all items separately.
  const includeForFilter: any[] = [];
  if (Number.isFinite(vendorId as number)) {
    includeForFilter.push({
      model: OrderItem,
      as: 'items',             // match your alias
      attributes: [],
      where: { vendorId: Number(vendorId) },
      required: true,
    });
  }

  const orders = await Order.findAll({
    where,
    include: includeForFilter,
    order: [[sort, dir]],
    limit,
  });

  const orderIds = orders.map((o) => Number((o as any).id)).filter((n) => Number.isFinite(n));
  const items = orderIds.length
    ? await OrderItem.findAll({ where: { orderId: { [Op.in]: orderIds } } })
    : [];

  const byOrderId = new Map<number, any[]>();
  for (const it of items) {
    const k = Number((it as any).orderId);
    const cur = byOrderId.get(k) ?? [];
    cur.push(it);
    byOrderId.set(k, cur);
  }

  const buyerIds = Array.from(
    new Set(orders.map((o) => Number((o as any).buyerUserId ?? 0)).filter((x) => Number.isFinite(x) && x > 0)),
  );
  const buyers = buyerIds.length
    ? await User.findAll({ where: { id: { [Op.in]: buyerIds } }, attributes: ['id', 'email'] })
    : [];

  const emailById = new Map<number, string>();
  for (const b of buyers) {
    const id = Number((b as any).id);
    const em = (b as any).email ?? '';
    if (Number.isFinite(id)) emailById.set(id, em);
  }

  const csv = buildAdminOrdersCsv(orders as any[], byOrderId as any, emailById);

  const file = `admin-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
  // Add UTF-8 BOM for Excel compatibility
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
