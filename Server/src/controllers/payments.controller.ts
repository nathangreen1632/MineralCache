// Server/src/controllers/payments.controller.ts
import type { Request, Response } from 'express';
import { createPaymentIntent as createPI, verifyStripeWebhook } from '../services/stripe.service.js';

/**
 * POST /api/payments/intent
 * Body: { amountCents: number, currency?: string }
 */
export async function createPaymentIntent(req: Request, res: Response): Promise<void> {
  try {
    const amountCentsRaw = (req.body)?.amountCents;
    const currencyRaw = (req.body)?.currency;

    const amountCents = Number(amountCentsRaw);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      res.status(400).json({ error: 'Bad amount' });
      return;
    }

    const currency =
      typeof currencyRaw === 'string' && currencyRaw.trim().length > 0
        ? currencyRaw.trim().toLowerCase()
        : undefined;

    const result = await createPI({ amountCents, currency });

    if (result.ok) {
      res.json({ ok: true, clientSecret: result.clientSecret });
      return;
    }

    // Map common error text from the service to appropriate HTTP codes
    const msg = (result.error ?? '').toLowerCase();
    if (msg.includes('not configured')) {
      res.status(503).json({ error: 'Payments disabled' });
      return;
    }
    if (msg.includes('invalid amount')) {
      res.status(400).json({ error: 'Bad amount' });
      return;
    }

    // Fallback
    res.status(502).json({ error: result.error || 'Failed to create intent' });
  } catch {
    res.status(500).json({ error: 'Failed to create intent' });
  }
}

/**
 * POST /api/payments/webhook
 * NOTE: Route must use `raw({ type: 'application/json' })` body parser.
 */
export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  try {
    const sig = (req.headers['stripe-signature'] as string | undefined) || null;
    const event = verifyStripeWebhook(req.body as unknown as Buffer, sig);

    // Minimal Week-1 handling — log a few important events
    switch (event.type) {
      case 'account.updated':
      case 'account.application.authorized':
      case 'payment_intent.succeeded':
      case 'charge.succeeded':
        // eslint-disable-next-line no-console
        console.log('[stripe]', event.type);
        break;
      default:
        // ignore others for now
        break;
    }

    res.status(200).json({ received: true });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Webhook error' });
  }
}
