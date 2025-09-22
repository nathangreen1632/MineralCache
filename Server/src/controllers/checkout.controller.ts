// Server/src/controllers/checkout.controller.ts
import type { Request, Response } from 'express';

/**
 * Checkout (stub): returns "payments unavailable" unless Stripe is configured.
 * Week-3 will wire totals + PaymentIntent. This exists now to hang the 18+ gate.
 */
export async function createCheckout(req: Request, res: Response): Promise<void> {
  const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY?.trim());

  if (!hasStripe) {
    res.status(503).json({
      ok: false,
      code: 'PAYMENTS_DISABLED',
      message: 'Payments are currently unavailable.',
    });
    return;
  }

  // Placeholder: we’ll implement PaymentIntent creation in Week-3.
  res.status(501).json({
    ok: false,
    code: 'NOT_IMPLEMENTED',
    message: 'Checkout will be enabled once payments are fully wired.',
  });
}
