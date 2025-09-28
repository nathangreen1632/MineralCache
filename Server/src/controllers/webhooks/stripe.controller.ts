// Server/src/controllers/webhooks/stripe.controller.ts
import type { Request, Response } from 'express';
import { verifyStripeWebhook, retrieveChargeWithBalanceTx } from '../../services/stripe.service.js';
import { db } from '../../models/sequelize.js';
import { Order } from '../../models/order.model.js';
import { OrderItem } from '../../models/orderItem.model.js';
import { Product } from '../../models/product.model.js';
import { obs } from '../../services/observability.service.js';

// ✅ NEW: email + buyer fetch
import { sendOrderEmail } from '../../services/email.service.js';
import { User } from '../../models/user.model.js';

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

    // ✅ Observability: note receipt of webhook
    obs.stripeWebhook(req, event.type, String((event as any)?.id || ''));

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

        // We'll capture these to send email after the transaction commits.
        let paidOrderId: number | null = null;
        let paidOrderNumber: string | null = null;
        let buyerUserId: number | null = null;

        await sequelize.transaction(async (t) => {
          const order = await Order.findOne({
            where: { paymentIntentId: intentId },
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          if (!order) return;              // no matching order, ignore gracefully
          if (order.status === 'paid') return; // idempotent: already processed

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

          // Stash for post-commit email
          paidOrderId = Number(order.id);

// Safely read optional order number without requiring it on the TS model
          const rawOrderNumber =
            (order as any)?.orderNumber ??
            (typeof (order as any)?.get === 'function' ? (order as any).get('orderNumber') : undefined) ??
            (typeof (order as any)?.get === 'function' ? (order as any).get('order_number') : undefined) ??
            null;

          paidOrderNumber = typeof rawOrderNumber === 'string' && rawOrderNumber.length > 0
            ? rawOrderNumber
            : null;

          buyerUserId = Number((order as any).buyerUserId ?? order.get?.('buyerUserId'));

          // ✅ Observability: order paid
          obs.orderPaid(req, Number(order.id), intentId);
        });

        // Send order confirmation email (post-commit; never blocks webhook success)
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
            // eslint-disable-next-line no-console
            console.warn('[webhook.email.order_paid] failed', err);
          }
        }

        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as any;
        const intentId = String(pi?.id || '');
        if (!intentId) break;

        // Resolve order id for richer logging (if present)
        const order = await Order.findOne({
          where: { paymentIntentId: intentId, status: 'pending_payment' },
          attributes: ['id'],
        });

        await Order.update(
          { status: 'failed', failedAt: new Date() },
          { where: { paymentIntentId: intentId, status: 'pending_payment' } }
        );

        // ✅ Observability: soft failure (decline, etc.)
        obs.orderFailed(
          req,
          order ? Number(order.id) : NaN,
          String(pi?.last_payment_error?.message || 'payment_failed')
        );
        break;
      }

      case 'charge.succeeded': {
        // Fetch fees/net from Balance Transaction for reconciliation
        const ch = event.data.object as any;
        const chargeId = String(ch?.id || '');
        const piId = String(ch?.payment_intent || '');
        if (!chargeId || !piId) break;

        try {
          const full = await retrieveChargeWithBalanceTx(chargeId);
          const bt = (full as any)?.balance_transaction;
          const feeCents = Number(bt?.fee ?? 0); // Stripe fees (smallest unit)
          const netCents = Number(bt?.net ?? 0); // Gross - fee - tax etc.

          const order = await Order.findOne({ where: { paymentIntentId: piId }, attributes: ['id'] });
          if (!order) {
            // No matching order; nothing to reconcile
            break;
          }

          // If you add columns later (stripeFeeCents/netCents), persist here.
          // await order.update({ stripeFeeCents: feeCents, stripeNetCents: netCents });
        } catch (err: any) {
          // Use the existing obs.error(req, event, err) signature
          obs.error(req, 'stripe.charge.fetch_failed', {
            chargeId,
            message: String(err?.message || err),
          });
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

        // Already noted via obs.stripeWebhook above; no extra event here.
        break;
      }

      default:
        // Already noted via obs.stripeWebhook above
        break;
    }

    res.json({ received: true });
  } catch (e: any) {
    // Keep graceful JSON error (Stripe expects 2xx for handled events, but this is a verify error)
    res.status(400).json({ error: e?.message || 'Webhook error' });
  }
}
