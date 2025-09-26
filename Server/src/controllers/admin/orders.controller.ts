// Server/src/controllers/admin/orders.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import { Order } from '../../models/order.model.js';
import { OrderItem } from '../../models/orderItem.model.js';
import { adminListOrdersSchema, adminOrderIdParamSchema } from '../../validation/adminOrders.schema.js';

function toDateBound(s?: string, endOfDay = false): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

/** GET /api/admin/orders */
export async function listAdminOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = adminListOrdersSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
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

    // If filtering by vendor, preselect order ids that have at least one item from that vendor
    if (vendorId) {
      const rows = await OrderItem.findAll({
        where: { vendorId },
        attributes: ['orderId'],
        group: ['orderId'],
      });
      const ids = rows.map((r: any) => Number(r.orderId));
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
      distinct: true, // ensures count is not multiplied by include
      include: [
        {
          model: OrderItem,
          attributes: ['id', 'orderId', 'productId', 'vendorId', 'title', 'unitPriceCents', 'quantity', 'lineTotalCents'],
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
      res.status(400).json({ error: 'Invalid order id', details: parsed.error.flatten() });
      return;
    }

    const order = await Order.findByPk(parsed.data.id, {
      include: [
        {
          model: OrderItem,
          attributes: ['id', 'orderId', 'productId', 'vendorId', 'title', 'unitPriceCents', 'quantity', 'lineTotalCents'],
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
