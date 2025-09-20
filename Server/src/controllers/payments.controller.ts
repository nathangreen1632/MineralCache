// Server/src/controllers/payments.controller.ts
import type { Request, Response } from 'express';
import { createPaymentIntent as createPI } from '../services/stripe.service.js';

export async function createPaymentIntent(req: Request, res: Response): Promise<void> {
  try {
    const amountCentsRaw = (req.body as any)?.amountCents;
    const currencyRaw = (req.body as any)?.currency;

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
