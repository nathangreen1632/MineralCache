// Server/src/services/stripe.service.ts
import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY || '';
export const stripeEnabled = secret.length > 0;

let stripe: Stripe | null = null;
if (stripeEnabled) {
  stripe = new Stripe(secret, { apiVersion: '2025-08-27.basil', maxNetworkRetries: 2 });
}

export async function createPaymentIntent(args: {
  amountCents: number;
  currency?: string;
}): Promise<{ ok: true; clientSecret: string } | { ok: false; clientSecret: null; error: string }> {
  if (!stripeEnabled || !stripe) {
    return { ok: false, clientSecret: null, error: 'Payments disabled' };
  }
  try {
    const pi = await stripe.paymentIntents.create({
      amount: Math.trunc(args.amountCents),
      currency: (args.currency || 'usd').toLowerCase(),
      automatic_payment_methods: { enabled: true },
    });
    if (!pi.client_secret) return { ok: false, clientSecret: null, error: 'No client secret' };
    return { ok: true, clientSecret: pi.client_secret };
  } catch (e: any) {
    return { ok: false, clientSecret: null, error: e?.message || 'Stripe error' };
  }
}

// ---------- Stripe Connect helpers

export async function ensureVendorStripeAccount(vendor: {
  stripeAccountId?: string | null;
  displayName?: string | null;
}): Promise<{ accountId: string | null; error?: string }> {
  if (!stripeEnabled || !stripe) return { accountId: null, error: 'Stripe is not configured' };

  const hasId = typeof vendor.stripeAccountId === 'string' && vendor.stripeAccountId.length > 0;
  if (hasId) return { accountId: String(vendor.stripeAccountId) };

  try {
    const account = await stripe.accounts.create({
      type: 'express',
      business_profile: { name: vendor.displayName || undefined },
      capabilities: { transfers: { requested: true } },
    });
    return { accountId: account.id };
  } catch (e: any) {
    return { accountId: null, error: e?.message || 'Failed to create account' };
  }
}

export async function createAccountLink(args: {
  accountId: string;
  platformBaseUrl: string; // e.g., https://mineralcache.com
}): Promise<{ url: string | null; error?: string }> {
  if (!stripeEnabled || !stripe) return { url: null, error: 'Stripe is not configured' };
  try {
    const link = await stripe.accountLinks.create({
      account: args.accountId,
      type: 'account_onboarding',
      refresh_url: `${args.platformBaseUrl}/vendor/onboarding/refresh`,
      return_url: `${args.platformBaseUrl}/vendor/dashboard`,
    });
    return { url: link.url || null };
  } catch (e: any) {
    return { url: null, error: e?.message || 'Failed to create onboarding link' };
  }
}

// ---------- Webhook verification

export function verifyStripeWebhook(rawBody: Buffer, sig: string | null) {
  if (!stripeEnabled || !stripe) throw new Error('Stripe disabled');
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!whSecret) throw new Error('No STRIPE_WEBHOOK_SECRET');
  return stripe.webhooks.constructEvent(rawBody, sig || '', whSecret);
}
