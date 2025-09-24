// Server/src/controllers/health.controller.ts
import type { Request, Response } from 'express';
import { getStripeStatus } from '../services/stripe.service.js';

export async function health(_req: Request, res: Response): Promise<void> {
  const stripe = getStripeStatus(); // { enabled, ready, missing: [] }
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    stripe,
  });
}
