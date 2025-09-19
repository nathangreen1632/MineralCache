import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY;
export const stripeEnabled = Boolean(secret);

export const stripe = stripeEnabled
  ? new Stripe(secret!, { apiVersion: '2025-08-27.basil' })
  : null;

export class StripeDisabledError extends Error {
  constructor() { super('Stripe is not configured'); }
}

export async function createPaymentIntent(args: {
  amountCents: number; currency?: string;
}): Promise<{ clientSecret: string }> {
  if (!stripeEnabled || !stripe) throw new StripeDisabledError();
  const pi = await stripe.paymentIntents.create({
    amount: args.amountCents,
    currency: args.currency ?? 'usd',
    automatic_payment_methods: { enabled: true },
  });
  return { clientSecret: pi.client_secret! };
}

// Add connect helpers later; all should guard on stripeEnabled
