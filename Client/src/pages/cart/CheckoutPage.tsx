// Client/src/pages/cart/CheckoutPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getCart } from '../../api/cart';
import { getHealth } from '../../api/health';
import { createCheckoutIntent } from '../../api/checkout';

type Load =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; totalCents: number }
  | { kind: 'error'; message: string };

function centsToUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function useStripePk(): { pk: string | null; error: string | null } {
  const pk = (import.meta as any)?.env?.VITE_STRIPE_PUBLISHABLE_KEY ?? null;
  if (typeof pk === 'string' && pk.trim().length > 0) return { pk, error: null };
  return { pk: null, error: 'Missing VITE_STRIPE_PUBLISHABLE_KEY' };
}

export default function CheckoutPage(): React.ReactElement {
  const [state, setState] = useState<Load>({ kind: 'idle' });
  const [stripeReady, setStripeReady] = useState<{ enabled: boolean; ready: boolean } | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);

  // 1) Load cart totals + stripe health
  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
      const [cartRes, healthRes] = await Promise.all([getCart(), getHealth()]);
      if (!alive) return;

      if (cartRes.error || !cartRes.data) {
        setState({ kind: 'error', message: cartRes.error || 'Failed to load cart' });
        return;
      }
      setState({ kind: 'loaded', totalCents: cartRes.data.totals?.total ?? 0 });

      if (healthRes.error || !healthRes.data) {
        setStripeReady({ enabled: false, ready: false });
        setHealthErr(healthRes.error || 'Unable to read server payment status.');
      } else {
        setStripeReady({
          enabled: !!healthRes.data.stripe.enabled,
          ready: !!healthRes.data.stripe.ready,
        });
        setHealthErr(null);
      }
    })();
    return () => { alive = false; };
  }, []);

  const { pk, error: pkErr } = useStripePk();
  const stripePromise = useMemo(() => (pk ? loadStripe(pk) : null), [pk]);

  const card = { background: 'var(--theme-surface)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' } as const;

  if (state.kind === 'loading' || state.kind === 'idle') {
    return (
      <section className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Checkout</h1>
        <div className="mt-4 h-28 rounded-2xl animate-pulse" style={{ background: 'var(--theme-card)' }} />
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="mx-auto max-w-3xl px-6 py-14 space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Checkout</h1>
        <div className="rounded-2xl border p-4" style={card}>
          <p style={{ color: 'var(--theme-error)' }}>{state.message}</p>
        </div>
      </section>
    );
  }

  // Loaded:
  const total = state.totalCents;

  let disabledMsg: string | null = null;
  if (!stripeReady?.enabled) {
    disabledMsg = 'Payments are currently disabled.';
  } else if (!stripeReady?.ready) {
    disabledMsg = 'Payments are not ready yet (missing server keys).';
  } else if (pkErr) {
    disabledMsg = pkErr;
  } else if (!stripePromise) {
    disabledMsg = 'Stripe is not initialized.';
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-14 space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Checkout</h1>

      <div className="rounded-2xl border p-6 grid gap-4" style={card}>
        <p className="text-sm opacity-80">
          Total due: <strong>{centsToUsd(total)}</strong>
        </p>

        {disabledMsg ? (
          <div className="rounded-xl border px-3 py-2 text-sm" style={card}>
            <p style={{ color: 'var(--theme-error)' }}>
              {disabledMsg}{healthErr ? ` (${healthErr})` : ''}
            </p>
          </div>
        ) : (
          <Elements
            stripe={stripePromise}
            options={{
              appearance: {
                variables: {
                  colorPrimary: 'var(--theme-link)',
                  colorBackground: 'var(--theme-surface)',
                  colorText: 'var(--theme-text)',
                  colorDanger: 'var(--theme-error)',
                  borderRadius: '12px',
                },
              },
            }}
          >
            <CardForm totalCents={total} />
          </Elements>
        )}
      </div>
    </section>
  );
}

function CardForm({ totalCents }: Readonly<{ totalCents: number }>) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!stripe || !elements) {
      setMsg('Stripe not ready yet.');
      return;
    }

    setBusy(true);

    // 1) Ask server to compute totals & create PI + Order(pending_payment)
    const { data, error, status } = await createCheckoutIntent();
    if (status === 503) {
      setBusy(false);
      setMsg('Payments are currently unavailable. Please try again later.');
      return;
    }
    if (error || !data?.clientSecret) {
      setBusy(false);
      setMsg(error || 'Failed to start checkout.');
      return;
    }

    // 2) Confirm card payment (handles 3DS when needed)
    const result = await stripe.confirmCardPayment(data.clientSecret, {
      payment_method: { card: elements.getElement(CardElement)! },
    });

    if (result.error) {
      setBusy(false);
      setMsg(result.error.message || 'Payment failed.');
      return;
    }

    if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
      // Success! Webhook will flip order -> paid and mark inventory.
      setBusy(false);
      navigate('/orders/confirmation', { state: { amountCents: totalCents } });
      return;
    }

    // Other statuses (processing, requires_payment_method, etc.)
    setBusy(false);
    setMsg(`Payment status: ${result.paymentIntent?.status || 'unknown'}`);
  }

  const cardBox = { background: 'var(--theme-card)', borderColor: 'var(--theme-border)' } as const;

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="rounded-xl border p-3" style={cardBox}>
        <CardElement options={{ hidePostalCode: true }} />
      </div>

      {msg ? (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={{
            background: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text)',
          }}
        >
          {msg}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy || !stripe || !elements || totalCents <= 0}
        className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-60"
      >
        {busy ? 'Processing…' : 'Pay now'}
      </button>
    </form>
  );
}
