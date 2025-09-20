// Server/src/services/stripe.service.ts
import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY || '';
export const stripeEnabled = secret.length > 0;

let stripe: Stripe | null = null;
if (stripeEnabled) {
  // Use a stable, current API version
  stripe = new Stripe(secret, { apiVersion: '2025-08-27.basil', maxNetworkRetries: 2 });
}

export async function createPaymentIntent(args: {
  amountCents: number;
  currency?: string;
}): Promise<{ ok: true; clientSecret: string } | { ok: false; clientSecret: null; error: string }> {
  if (!stripeEnabled || !stripe) {
    return { ok: false, clientSecret: null, error: 'Stripe is not configured' };
  }

  const amount = Number(args.amountCents);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, clientSecret: null, error: 'Invalid amount' };
  }

  try {
    const pi = await stripe.paymentIntents.create({
      amount,
      currency: args.currency && args.currency.length > 0 ? args.currency : 'usd',
      automatic_payment_methods: { enabled: true },
    });
    const secretVal = pi?.client_secret || '';
    if (secretVal.length === 0) {
      return { ok: false, clientSecret: null, error: 'Missing client secret' };
    }
    return { ok: true, clientSecret: secretVal };
  } catch (e: any) {
    const message = typeof e?.message === 'string' && e.message.length > 0 ? e.message : 'Failed to create PaymentIntent';
    return { ok: false, clientSecret: null, error: message };
  }
}

// ---------- Stripe Connect helpers (graceful, no throws)

export async function ensureVendorStripeAccount(vendor: {
  stripeAccountId?: string | null;
  displayName?: string | null;
}): Promise<{ accountId: string | null; error?: string }> {
  if (!stripeEnabled || !stripe) {
    return { accountId: null, error: 'Stripe is not configured' };
  }

  const hasId = typeof vendor.stripeAccountId === 'string' && vendor.stripeAccountId.length > 0;
  if (hasId) {
    return { accountId: String(vendor.stripeAccountId) };
  }

  const name = typeof vendor.displayName === 'string' && vendor.displayName.length > 0 ? vendor.displayName : 'Vendor';

  try {
    const acct = await stripe.accounts.create({
      type: 'express',
      business_type: 'individual',
      business_profile: { name },
      capabilities: { transfers: { requested: true } },
    });
    return { accountId: acct.id };
  } catch (e: any) {
    const message = typeof e?.message === 'string' && e.message.length > 0 ? e.message : 'Failed to create Connect account';
    return { accountId: null, error: message };
  }
}

export async function createAccountLink(accountId: string): Promise<{ url: string | null; error?: string }> {
  if (!stripeEnabled || !stripe) {
    return { url: null, error: 'Stripe is not configured' };
  }

  const platform = process.env.PLATFORM_URL && process.env.PLATFORM_URL.length > 0
    ? process.env.PLATFORM_URL
    : 'http://localhost:5173';

  try {
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${platform}/vendor/onboarding/refresh`,
      return_url: `${platform}/vendor/dashboard`,
    });
    const url = typeof link?.url === 'string' && link.url.length > 0 ? link.url : '';
    if (url.length === 0) {
      return { url: null, error: 'Failed to create onboarding link' };
    }
    return { url };
  } catch (e: any) {
    const message = typeof e?.message === 'string' && e.message.length > 0 ? e.message : 'Failed to create onboarding link';
    return { url: null, error: message };
  }
}
