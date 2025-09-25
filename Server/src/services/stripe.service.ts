// Server/src/services/stripe.service.ts
import Stripe from 'stripe';

// ---------- Feature flag + key detection

const FLAG = String(process.env.STRIPE_ENABLED ?? '').trim().toLowerCase();
export const stripeFeatureEnabled =
  FLAG === '1' || FLAG === 'true' || FLAG === 'yes' || FLAG === 'on';

// Backwards-compat: preserve the old name for existing imports
export const stripeEnabled = stripeFeatureEnabled;

const secret = String(process.env.STRIPE_SECRET_KEY ?? '').trim();

let stripe: Stripe | null = null;

/** Initialize Stripe client ONLY if feature flag is on and key present */
if (stripeFeatureEnabled && secret.length > 0) {
  // Keep your pinned API version
  stripe = new Stripe(secret, {
    apiVersion: '2025-08-27.basil',
    maxNetworkRetries: 2,
  });
}

/** Health helper for /health */
export function getStripeStatus() {
  const hasSecret = secret.length > 0;
  const ready = stripeFeatureEnabled ? hasSecret && !!stripe : false;
  const missing: string[] = [];

  if (stripeFeatureEnabled && !hasSecret) missing.push('STRIPE_SECRET_KEY');
  if (stripeFeatureEnabled && !process.env.STRIPE_WEBHOOK_SECRET) missing.push('STRIPE_WEBHOOK_SECRET');

  return {
    enabled: stripeFeatureEnabled,
    ready,
    missing,
  };
}

/** Hard fail at boot if STRIPE_ENABLED=true but required keys are missing */
export function assertStripeAtBoot() {
  const status = getStripeStatus();
  if (status.enabled && !status.ready) {
    const list = status.missing.length > 0 ? ` Missing: ${status.missing.join(', ')}` : '';
    throw new Error(`Stripe ENABLED but not READY.${list}`);
  }
}

// ---------- Core PaymentIntent creation

export async function createPaymentIntent(args: {
  amountCents: number;
  currency?: string;
  /** optional metadata passthrough (additive) */
  metadata?: Record<string, string>;
  /** optional idempotency key for retried submits */
  idempotencyKey?: string;
}): Promise<
  | { ok: true; clientSecret: string; intentId: string }
  | { ok: false; clientSecret: null; error: string }
> {
  const status = getStripeStatus();
  if (!status.enabled) return { ok: false, clientSecret: null, error: 'Payments disabled' };
  if (!status.ready || !stripe) return { ok: false, clientSecret: null, error: 'Payments not ready' };

  try {
    const options: Stripe.RequestOptions | undefined = args.idempotencyKey
      ? { idempotencyKey: args.idempotencyKey }
      : undefined;

    const pi = await stripe.paymentIntents.create(
      {
        amount: Math.round(Number(args.amountCents || 0)),
        currency: (args.currency ?? 'usd').toLowerCase(),
        // Connect application fees are intentionally NOT used yet (flag off).
        // Carry platform fee and other info in metadata for webhook reconciliation.
        metadata: args.metadata ?? {},
        // Allow 3DS when required
        automatic_payment_methods: { enabled: true },
      },
      options
    );

    if (!pi.client_secret) {
      return { ok: false, clientSecret: null, error: 'No client secret returned' };
    }
    return { ok: true, clientSecret: pi.client_secret, intentId: pi.id };
  } catch (e: any) {
    return { ok: false, clientSecret: null, error: e?.message || 'Failed to create PaymentIntent' };
  }
}

// ---------- Webhook verification

export function verifyStripeWebhook(rawBody: Buffer, sig: string | null) {
  const status = getStripeStatus();
  if (!status.enabled || !status.ready || !stripe) throw new Error('Stripe disabled');

  const whSecret = String(process.env.STRIPE_WEBHOOK_SECRET ?? '').trim();
  if (!whSecret) throw new Error('No STRIPE_WEBHOOK_SECRET');

  return stripe.webhooks.constructEvent(rawBody, sig || '', whSecret);
}

// ---------- Stripe Connect helpers (kept for admin/vendor flows)

export async function ensureVendorStripeAccount(vendor: {
  stripeAccountId?: string | null;
  displayName?: string | null;
}): Promise<{ accountId: string | null; error?: string }> {
  const status = getStripeStatus();
  if (!status.enabled || !status.ready || !stripe) {
    return { accountId: null, error: 'Stripe is not configured' };
  }

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
  const status = getStripeStatus();
  if (!status.enabled || !status.ready || !stripe) {
    return { url: null, error: 'Stripe is not configured' };
  }
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

// ---------- Charges / fees helpers

/**
 * Retrieve a Charge with its Balance Transaction expanded so you can read
 * Stripe fees (`fee`) and `net` right inside the payload.
 * Use from your webhook on `charge.succeeded`.
 */
export async function retrieveChargeWithBalanceTx(chargeId: string) {
  const status = getStripeStatus();
  if (!status.enabled || !status.ready || !stripe) {
    throw new Error('Stripe disabled');
  }
  // `expand` lets us include the balance_transaction inline
  return stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] });
}
