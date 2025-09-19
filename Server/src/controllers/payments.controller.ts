// Server/src/controllers/payments.controller.ts
import type { Request, Response } from 'express';
import { createPaymentIntent as createPI, StripeDisabledError } from '../services/stripe.service.js';

export async function createPaymentIntent(req: Request, res: Response): Promise<void> {
  try {
    const amountCents = Number(req.body?.amountCents ?? 0);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      res.status(400).json({ error: 'Bad amount' }); return;
    }
    const out = await createPI({ amountCents });
    res.json(out);
  } catch (e) {
    if (e instanceof StripeDisabledError) { res.status(503).json({ error: 'Payments disabled' }); return; }
    res.status(500).json({ error: 'Failed to create intent' });
  }
}
