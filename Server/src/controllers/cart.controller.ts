// Server/src/controllers/cart.controller.ts
import type { Request, Response } from 'express';
import { stripeEnabled, createPaymentIntent } from '../services/stripe.service.js';
import { ensureAuthed, ensureAdult } from '../middleware/authz.middleware.js';

/** ------------------------------------------------------------------------
 * Cart endpoints
 * -----------------------------------------------------------------------*/
export async function getCart(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  // TODO: fetch cart by req.user.id
  res.json({ items: [], totals: { subtotal: 0, shipping: 0, total: 0 } });
}

export async function putCart(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  // TODO: upsert items for req.user.id from req.body
  res.json({ ok: true });
}

export async function checkout(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;
  if (!ensureAdult(req, res)) return;

  if (!stripeEnabled) {
    res.status(503).json({ error: 'Payments disabled' });
    return;
  }

  // TODO: compute real totals from the user’s cart
  const amountCents = Number(req.body?.amountCents ?? 0);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    res.status(400).json({ error: 'Bad amount' });
    return;
  }

  const result = await createPaymentIntent({ amountCents });
  if (!result.ok) {
    const msg = result.error || 'Failed to start checkout';
    res.status(502).json({ error: msg });
    return;
  }

  res.json({ clientSecret: result.clientSecret });
}
