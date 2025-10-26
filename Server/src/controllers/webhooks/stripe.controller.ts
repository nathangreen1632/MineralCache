// Server/src/controllers/webhooks/stripe.controller.ts
import type { Request, Response } from 'express';
import { verifyStripeWebhook } from '../../services/stripe.service.js';
import { db } from '../../models/sequelize.js';
import { Order } from '../../models/order.model.js';
import { OrderItem } from '../../models/orderItem.model.js';
import { Product } from '../../models/product.model.js';
import { obs } from '../../services/observability.service.js';
import { OrderVendor } from '../../models/orderVendor.model.js';
import { WebhookEvent } from '../../models/webhookEvent.model.js';
import { log } from '../../services/log.service.js';
import { sendOrderEmail } from '../../services/email.service.js';
import { User } from '../../models/user.model.js';
import { AuctionLock } from '../../models/auctionLock.model.js';
import { Op } from 'sequelize';

export async function createPaymentIntent(_req: Request, res: Response): Promise<void> {
  res.status(410).json({ error: 'Use /api/checkout/intent' });
}

export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  try {
    const sig = (req.headers['stripe-signature'] as string) ?? null;
    const event = verifyStripeWebhook(req.body as unknown as Buffer, sig);

    const source = 'stripe';
    const eventId = String((event as any)?.id || '');
    const type = String(event.type);

    try {
      await WebhookEvent.create({
        source,
        eventId,
        type,
        status: 'received',
        payload: process.env.NODE_ENV === 'production' ? null : (event as any),
      } as any);
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isUnique =
        msg.toLowerCase().includes('unique') ||
        String(err?.name) === 'SequelizeUniqueConstraintError';
      if (isUnique) {
        log.info('webhook.duplicate_suppressed', { source, type, eventId });
        res.json({ received: true, duplicate: true });
        return;
      }
      throw err;
    }

    obs.stripeWebhook(req, type, eventId);

    const sequelize = db.instance();
    if (!sequelize) {
      await WebhookEvent.update({ status: 'error' }, { where: { source, eventId } });
      res.status(500).json({ error: 'DB not initialized' });
      return;
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as any;
        const intentId = String(pi?.id || '');
        if (!intentId) break;

        let paidOrderId: number | null = null;
        let paidOrderNumber: string | null = null;
        let buyerUserId: number | null = null;

        await sequelize.transaction(async (t) => {
          const order = await Order.findOne({
            where: { paymentIntentId: intentId },
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          if (!order) return;
          if (order.status === 'paid') return;

          order.status = 'paid';
          order.paidAt = new Date();
          await order.save({ transaction: t });

          const buyerId = Number((order as any).buyerUserId ?? order.get?.('buyerUserId'));

          const items = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });
          const productIds = items.map((i) => Number(i.productId)).filter(Number.isFinite);
          if (productIds.length > 0) {
            const now = new Date();
            await Product.update({ archivedAt: now }, { where: { id: productIds }, transaction: t });
            await AuctionLock.update(
              { status: 'paid' },
              { where: { productId: { [Op.in]: productIds }, userId: buyerId, status: 'active' }, transaction: t }
            );
          }

          const vendorLineTotals = new Map<number, number>();
          const vendorFees = new Map<number, number>();
          for (const it of items) {
            const vId = Number(it.vendorId);
            vendorLineTotals.set(vId, (vendorLineTotals.get(vId) || 0) + Number(it.lineTotalCents || 0));
            vendorFees.set(vId, (vendorFees.get(vId) || 0) + Number((it as any).commissionCents || 0));
          }

          const shippingSnap =
            ((order as any).vendorShippingJson || {}) as Record<string, { cents?: number }>;
          const vendorShipping = new Map<number, number>();
          for (const [k, v] of Object.entries(shippingSnap)) {
            const vId = Number(k);
            vendorShipping.set(vId, Number((v as any)?.cents || 0));
          }

          const vendorIds = new Set<number>([...vendorLineTotals.keys(), ...vendorShipping.keys()]);
          for (const vId of vendorIds) {
            const gross = (vendorLineTotals.get(vId) || 0) + (vendorShipping.get(vId) || 0);
            const fee = vendorFees.get(vId) || 0;
            const net = Math.max(0, gross - fee);

            const [row, created] = await OrderVendor.findOrCreate({
              where: { orderId: Number(order.id), vendorId: vId },
              defaults: {
                orderId: Number(order.id),
                vendorId: vId,
                vendorGrossCents: gross,
                vendorFeeCents: fee,
                vendorNetCents: net,
              },
              transaction: t,
            });
            if (!created) {
              await row.update(
                { vendorGrossCents: gross, vendorFeeCents: fee, vendorNetCents: net },
                { transaction: t }
              );
            }
          }

          paidOrderId = Number(order.id);
          const rawOrderNumber =
            (order as any)?.orderNumber ??
            (typeof (order as any)?.get === 'function' ? (order as any).get('orderNumber') : undefined) ??
            (typeof (order as any)?.get === 'function' ? (order as any).get('order_number') : undefined) ??
            null;

          paidOrderNumber =
            typeof rawOrderNumber === 'string' && rawOrderNumber.length > 0 ? rawOrderNumber : null;

          buyerUserId = Number((order as any).buyerUserId ?? order.get?.('buyerUserId'));

          obs.orderPaid(req, Number(order.id), intentId);
        });

        if (paidOrderId && buyerUserId) {
          try {
            const buyer = await User.findByPk(buyerUserId);
            if (buyer?.email) {
              const items = await OrderItem.findAll({ where: { orderId: paidOrderId } });
              const itemsBrief = items
                .map((i) => {
                  const qty = i.quantity;
                  return `• ${i.title} ×${qty}`;
                })
                .join('<br/>');

              await sendOrderEmail('order_paid', {
                orderId: paidOrderId,
                orderNumber: paidOrderNumber,
                buyer: { email: buyer.email, name: (buyer as any)?.fullName ?? null },
                itemsBrief,
              });
            }
          } catch (err) {
            console.warn('[webhook.email.order_paid] failed', err);
          }
        }

        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as any;
        const intentId = String(pi?.id || '');
        if (!intentId) break;

        const order = await Order.findOne({
          where: { paymentIntentId: intentId, status: 'pending_payment' },
          attributes: ['id'],
        });

        await Order.update(
          { status: 'failed', failedAt: new Date() },
          { where: { paymentIntentId: intentId, status: 'pending_payment' } }
        );

        obs.orderFailed(
          req,
          order ? Number(order.id) : NaN,
          String(pi?.last_payment_error?.message || 'payment_failed')
        );
        break;
      }

      case 'charge.succeeded': {
        const ch = event.data.object as any;
        const chargeId = String(ch?.id || '');
        const piId = String(ch?.payment_intent || '');
        if (!chargeId || !piId) break;

        try {
          const order = await Order.findOne({ where: { paymentIntentId: piId }, attributes: ['id'] });
          if (!order) break;
        } catch (err: any) {
          obs.error(req, 'stripe.charge.fetch_failed', { chargeId, message: String(err?.message || err) });
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as any;
        const intentId = String(charge?.payment_intent || '');
        if (!intentId) break;

        await Order.update(
          { status: 'refunded', refundedAt: new Date() },
          { where: { paymentIntentId: intentId } }
        );
        break;
      }

      default:
        break;
    }

    await WebhookEvent.update(
      { status: 'processed', processedAt: new Date() },
      { where: { source, eventId } }
    );

    res.json({ received: true });
  } catch (e: any) {
    log.error('webhook.error', { err: e?.message });
    res.status(400).json({ error: e?.message || 'Webhook error' });
  }
}
