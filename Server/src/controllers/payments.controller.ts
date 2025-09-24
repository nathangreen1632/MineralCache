// Server/src/controllers/payments.controller.ts
import type { Request, Response } from 'express';
import { verifyStripeWebhook } from '../services/stripe.service.js';

export async function createPaymentIntent(_req: Request, res: Response): Promise<void> {
  // Kept only if you still want /api/payments/intent; /checkout/intent is the recommended path now.
  res.status(410).json({ error: 'Use /api/checkout/intent' });
}

/** POST /api/webhooks/stripe (raw body) */
export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  try {
    const sig = (req.headers['stripe-signature'] as string) ?? null;
    // raw body is required; webhooks.route.ts uses raw({ type: 'application/json' })
    const event = verifyStripeWebhook(req.body as unknown as Buffer, sig);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as any;
        // TODO (Orders E2E): locate order by pi.id and mark paid, lock inventory, etc.
        // eslint-disable-next-line no-console
        console.log('[stripe] payment_intent.succeeded', {
          id: pi?.id,
          amount: pi?.amount,
          metadata: pi?.metadata,
        });
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as any;
        // TODO: mark order failed if applicable
        // eslint-disable-next-line no-console
        console.log('[stripe] payment_intent.payment_failed', {
          id: pi?.id,
          last_payment_error: pi?.last_payment_error,
        });
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as any;
        // TODO: mark order refunded if applicable
        // eslint-disable-next-line no-console
        console.log('[stripe] charge.refunded', {
          id: charge?.id,
          amount_refunded: charge?.amount_refunded,
        });
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
