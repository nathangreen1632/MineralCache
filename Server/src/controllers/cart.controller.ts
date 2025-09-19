// Server/src/controllers/cart.controller.ts
import type { Request, Response } from 'express';

export async function getCart(_req: Request, res: Response): Promise<void> {
  res.json({ items: [], totals: { subtotal: 0, shipping: 0, total: 0 } });
}
export async function putCart(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true });
}
export async function checkout(_req: Request, res: Response): Promise<void> {
  // returns clientSecret when Stripe is enabled
  res.status(503).json({ error: 'Payments disabled' });
}
