// Server/src/services/stripe.service.ts
import Stripe from 'stripe';

const FLAG = String(process.env.STRIPE_ENABLED ?? '').trim().toLowerCase();
export const stripeFeatureEnabled =
  FLAG === '1' || FLAG === 'true' || FLAG === 'yes' || FLAG === 'on';

export const stripeEnabled = stripeFeatureEnabled;

const secret = String(process.env.STRIPE_SECRET_KEY ?? '').trim();

let stripe: Stripe | null = null;

if (stripeFeatureEnabled && secret.length > 0) {
  stripe = new Stripe(secret, {
    apiVersion: '2025-08-27.basil',
    maxNetworkRetries: 2,
  });
}

export type StripeStatus = {
  enabled: boolean;
  ready: boolean;
  missing: string[];
  mode: 'test' | 'live' | 'disabled';
};

export function getStripeStatus(): StripeStatus {
  const enabled = stripeFeatureEnabled;
  const hasSecret = secret.length > 0;
  const missing: string[] = [];

  if (enabled && !hasSecret) missing.push('STRIPE_SECRET_KEY');
  if (enabled && !process.env.STRIPE_WEBHOOK_SECRET) missing.push('STRIPE_WEBHOOK_SECRET');

  let mode: StripeStatus['mode'] = 'disabled';
  if (enabled) {
    mode = secret.startsWith('sk_live_') ? 'live' : 'test';
  }

  const ready = enabled ? missing.length === 0 && !!stripe : false;

  return {
    enabled,
    ready,
    missing,
    mode,
  };
}

export function assertStripeAtBoot() {
  const status = getStripeStatus();
  if (status.enabled && !status.ready) {
    const list = status.missing.length > 0 ? ` Missing: ${status.missing.join(', ')}` : '';
    throw new Error(`Stripe ENABLED but not READY.${list}`);
  }
}

export async function createPaymentIntent(args: {
  amountCents: number;
  currency?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
  shipping?: Stripe.PaymentIntentCreateParams.Shipping;
}): Promise<
  | { ok: true; clientSecret: string; intentId: string }
  | { ok: false; clientSecret: null; error: string }
> {
  const status = getStripeStatus();
  if (!status.enabled) return { ok: false, clientSecret: null, error: 'Payments disabled' };
  if (!status.ready || !stripe) return { ok: false, clientSecret: null, error: 'Payments not ready' };

  try {
    const params: Stripe.PaymentIntentCreateParams = {
      amount: args.amountCents,
      currency: args.currency || 'usd',
      metadata: args.metadata,
      automatic_payment_methods: { enabled: true },
    };

    if (args.shipping) {
      params.shipping = args.shipping;
    }

    const options: Stripe.RequestOptions = {};
    if (args.idempotencyKey) {
      options.idempotencyKey = args.idempotencyKey;
    }

    const intent = await stripe.paymentIntents.create(params, options);
    if (!intent.client_secret) {
      return { ok: false, clientSecret: null, error: 'No client_secret on PaymentIntent' };
    }

    return { ok: true, clientSecret: intent.client_secret, intentId: intent.id };
  } catch (e: any) {
    return { ok: false, clientSecret: null, error: e?.message || 'Failed to create PaymentIntent' };
  }
}

export function verifyStripeWebhook(rawBody: Buffer, sig: string | null) {
  const status = getStripeStatus();
  if (!status.enabled || !status.ready || !stripe) throw new Error('Stripe disabled');

  const whSecret = String(process.env.STRIPE_WEBHOOK_SECRET ?? '').trim();
  if (!whSecret) throw new Error('No STRIPE_WEBHOOK_SECRET');

  return stripe.webhooks.constructEvent(rawBody, sig || '', whSecret);
}

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
  platformBaseUrl: string;
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

export async function retrieveChargeWithBalanceTx(chargeId: string) {
  const status = getStripeStatus();
  if (!status.enabled || !status.ready || !stripe) {
    throw new Error('Stripe disabled');
  }
  return stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] });
}

export async function createRefund(opts: {
  paymentIntentId: string;
  reason?: 'requested_by_customer' | 'duplicate' | 'fraudulent';
}): Promise<{ ok: true; refundId: string } | { ok: false; error: string }> {
  const status = getStripeStatus();
  if (!status.enabled || !status.ready || !stripe) {
    return { ok: false, error: 'Stripe not initialized' };
  }
  try {
    const refund = await stripe.refunds.create({
      payment_intent: opts.paymentIntentId,
      reason: opts.reason,
    });
    return { ok: true, refundId: refund.id };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function cancelPaymentIntent(
  paymentIntentId: string
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const status = getStripeStatus();
  if (!status.enabled || !status.ready || !stripe) {
    return { ok: false, error: 'Stripe not initialized' };
  }
  try {
    const pi = await stripe.paymentIntents.cancel(paymentIntentId);
    return { ok: true, status: pi.status };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function createVendorTransfer(args: {
  accountId: string;
  amountCents: number;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<{ ok: true; transferId: string } | { ok: false; error: string }> {
  const status = getStripeStatus();
  if (!status.enabled || !status.ready || !stripe) {
    return { ok: false, error: 'Stripe not initialized' };
  }

  try {
    const transfer = await stripe.transfers.create({
      amount: args.amountCents,
      currency: 'usd',
      destination: args.accountId,
      description: args.description,
      metadata: args.metadata,
    });

    return { ok: true, transferId: transfer.id };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}

