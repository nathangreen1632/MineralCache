// Server/src/controllers/admin/orders.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { Order } from '../../models/order.model.js';
import { OrderItem } from '../../models/orderItem.model.js';
import {
  adminListOrdersSchema,
  adminOrderIdParamSchema,
} from '../../validation/adminOrders.schema.js';

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

/** GET /api/admin/orders */
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

/** GET /api/admin/orders/:id */
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

// ======================= NEW: Admin Refund =======================

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
