// Server/src/controllers/payments.controller.ts
import type { Request, Response } from 'express';
import { verifyStripeWebhook } from '../services/stripe.service.js';
import { db } from '../models/sequelize.js';
import { Order } from '../models/order.model.js';
import { OrderItem } from '../models/orderItem.model.js';
import { Product } from '../models/product.model.js';

export async function createPaymentIntent(_req: Request, res: Response): Promise<void> {
  // Use the new checkout flow
  res.status(410).json({ error: 'Use /api/checkout/intent' });
}

/** POST /api/webhooks/stripe (raw body) */
export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  try {
    const sig = (req.headers['stripe-signature'] as string) ?? null;
    // raw body is required; webhooks.route.ts uses raw({ type: 'application/json' })
    const event = verifyStripeWebhook(req.body as unknown as Buffer, sig);

    const sequelize = db.instance();
    if (!sequelize) {
      res.status(500).json({ error: 'DB not initialized' });
      return;
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as any;
        const intentId = String(pi?.id || '');
        if (!intentId) break;

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

          // Inventory lock: archive purchased products
          const items = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });
          const productIds = items
            .map((i) => Number(i.productId))
            .filter((n) => Number.isFinite(n));
          if (productIds.length > 0) {
            const now = new Date();
            await Product.update(
              { archivedAt: now },
              { where: { id: productIds }, transaction: t }
            );
          }
        });

        // eslint-disable-next-line no-console
        console.log('[stripe] payment_intent.succeeded', { id: intentId });
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as any;
        const intentId = String(pi?.id || '');
        if (!intentId) break;

        await Order.update(
          { status: 'failed', failedAt: new Date() },
          { where: { paymentIntentId: intentId, status: 'pending_payment' } }
        );

        // eslint-disable-next-line no-console
        console.log('[stripe] payment_intent.payment_failed', { id: intentId });
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

        // eslint-disable-next-line no-console
        console.log('[stripe] charge.refunded', { id: charge?.id, payment_intent: intentId });
        break;
      }

      default:
        // eslint-disable-next-line no-console
        console.log('[stripe] event', event.type);
        break;
    }

    res.json({ received: true });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Webhook error' });
  }
}
