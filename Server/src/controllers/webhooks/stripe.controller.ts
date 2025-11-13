// Server/src/controllers/webhooks/stripe.controller.ts
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { verifyStripeWebhook } from '../../services/stripe.service.js';
import { Order } from '../../models/order.model.js';
import { OrderItem } from '../../models/orderItem.model.js';
import { Product } from '../../models/product.model.js';
import { obs } from '../../services/observability.service.js';
import { WebhookEvent } from '../../models/webhookEvent.model.js';
import { log } from '../../services/log.service.js';
import { sendOrderEmail } from '../../services/email.service.js';
import { User } from '../../models/user.model.js';
import { AuctionLock } from '../../models/auctionLock.model.js';
import { Op } from 'sequelize';
import { Vendor } from '../../models/vendor.model.js';
import { materializeOrderVendorMoney } from '../../services/payouts.service.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2025-08-27.basil' });

export async function createPaymentIntent(_req: Request, res: Response): Promise<void> {
  res.status(410).json({ error: 'Use /api/checkout/intent' });
}

async function syncVendorStripeSnapshotByAccountId(accountId: string, acct?: Stripe.Account) {
  const account = acct ?? (await stripe.accounts.retrieve(accountId).catch(() => null));
  if (!account) return;

  const reqs = account.requirements;
  const requirementsDue =
    (reqs?.currently_due?.length ?? 0) +
    (reqs?.past_due?.length ?? 0) +
    (reqs?.pending_verification?.length ?? 0);

  await Vendor.update(
    {
      stripeChargesEnabled: Boolean(account.charges_enabled),
      stripePayoutsEnabled: Boolean(account.payouts_enabled),
      stripeDetailsSubmitted: Boolean(account.details_submitted),
      stripeRequirementsDue: requirementsDue,
      stripeLastSyncAt: new Date(),
    },
    { where: { stripeAccountId: account.id } }
  );
}

function extractAccountId(ev: any): string | null {
  return (ev?.account as string) ?? (ev?.data?.object?.account as string) ?? null;
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
      log.error('webhook.persist_failed', { source, type, eventId, error: msg });
      res.status(202).json({ received: true });
      return;
    }

    obs.stripeWebhook(req, type, eventId);

    const sequelize = Order.sequelize;
    if (!sequelize) {
      await WebhookEvent.update({ status: 'error' }, { where: { source, eventId } });
      res.status(500).json({ error: 'DB not initialized' });
      return;
    }

    switch (event.type) {
      case 'account.updated': {
        const acct = event.data.object;
        await syncVendorStripeSnapshotByAccountId(acct.id, acct);
        break;
      }

      case 'capability.updated':
      case 'account.external_account.created':
      case 'financial_connections.account.created':
      case 'account.application.authorized': {
        const accountId = extractAccountId(event);
        if (accountId) await syncVendorStripeSnapshotByAccountId(accountId);
        break;
      }

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
          if ((order as any).status === 'paid') return;

          (order as any).status = 'paid';
          (order as any).paidAt = new Date();
          await order.save({ transaction: t });

          const buyerId = Number((order as any).buyerUserId ?? (order as any)?.get?.('buyerUserId'));

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

          paidOrderId = Number(order.id);
          const rawOrderNumber =
            (order as any)?.orderNumber ??
            (typeof (order as any)?.get === 'function' ? (order as any).get('orderNumber') : undefined) ??
            (typeof (order as any)?.get === 'function' ? (order as any).get('order_number') : undefined) ??
            null;

          paidOrderNumber =
            typeof rawOrderNumber === 'string' && rawOrderNumber.length > 0 ? rawOrderNumber : null;

          buyerUserId = Number((order as any).buyerUserId ?? (order as any)?.get?.('buyerUserId'));

          obs.orderPaid(req, Number(order.id), intentId);
        });

        if (paidOrderId) {
          try {
            await materializeOrderVendorMoney(paidOrderId);
          } catch (e) {
            log.warn('webhook.payouts.materialize_failed', { orderId: paidOrderId, error: String((e as any)?.message || e) });
          }
        }

        if (paidOrderId && buyerUserId) {
          try {
            const buyer = await User.findByPk(buyerUserId);
            if (buyer?.email) {
              const items = await OrderItem.findAll({ where: { orderId: paidOrderId } });
              const itemsBrief = items
                .map((i) => {
                  const qty = i.quantity;
                  return '• ' + i.title + ' ×' + qty;
                })
                .join('<br/>');

              const ord = await Order.findByPk(paidOrderId, {
                attributes: ['subtotalCents', 'shippingCents', 'taxCents', 'totalCents'],
              });

              await sendOrderEmail('order_paid', {
                orderId: paidOrderId,
                orderNumber: paidOrderNumber,
                buyer: { email: buyer.email, name: (buyer as any)?.fullName ?? null },
                itemsBrief,
                subtotalCents: Number((ord as any)?.subtotalCents ?? 0),
                shippingCents: Number((ord as any)?.shippingCents ?? 0),
                taxCents: Number((ord as any)?.taxCents ?? 0),
                totalCents: Number((ord as any)?.totalCents ?? 0),
              });
            }
          } catch (err) {
            log.warn('webhook.email.order_paid_failed', { error: String((err as any)?.message || err) });
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
