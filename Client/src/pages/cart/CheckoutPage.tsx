// Client/src/pages/cart/CheckoutPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getHealth } from '../../api/health';
import { createCheckoutIntent } from '../../api/checkout';
import { useCartTotals } from '../../hooks/useCartTotals';
import { emit } from '../../lib/eventBus';
import { EV_CART_CHANGED } from '../../lib/events';
import CommissionPreview from "../../components/cart/CommissionPreview.tsx";
import AcceptedCards from "../../components/payment/AcceptedCards.tsx";

type LoadHealth =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; enabled: boolean; ready: boolean }
  | { kind: 'error'; message: string };

function centsToUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function useStripePk(): { pk: string | null; error: string | null } {
  const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? null;
  if (typeof pk === 'string' && pk.trim().length > 0) return { pk, error: null };
  return { pk: null, error: 'Missing VITE_STRIPE_PUBLISHABLE_KEY' };
}

export default function CheckoutPage(): React.ReactElement {
  // Server-sourced totals with auto-refresh on cart/shipping changes
  const { state: totalsState } = useCartTotals();

  // Stripe readiness from server /health
  const [health, setHealth] = useState<LoadHealth>({ kind: 'idle' });
  const [healthErr, setHealthErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setHealth({ kind: 'loading' });
      const { data, error } = await getHealth();
      if (!alive) return;
      if (error || !data) {
        setHealth({ kind: 'error', message: error || 'Unable to read server payment status.' });
        setHealthErr(error || 'Unable to read server payment status.');
        return;
      }
      setHealth({ kind: 'loaded', enabled: data.stripe.enabled, ready: data.stripe.ready });
      setHealthErr(null);
    })();
    return () => { alive = false; };
  }, []);

  const { pk, error: pkErr } = useStripePk();
  const stripePromise = useMemo(() => (pk ? loadStripe(pk) : null), [pk]);

  const card = { background: 'var(--theme-surface)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' } as const;

  // Loading skeleton until BOTH totals and health are available
  const totalsLoading = totalsState.kind === 'idle' || totalsState.kind === 'loading';
  const healthLoading = health.kind === 'idle' || health.kind === 'loading';

  if (totalsLoading || healthLoading) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Checkout</h1>
        <div className="mt-4 h-28 rounded-2xl animate-pulse" style={{ background: 'var(--theme-card)' }} />
      </section>
    );
  }

  if (totalsState.kind === 'error') {
    return (
      <section className="mx-auto max-w-3xl px-6 py-14 space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Checkout</h1>
        <div className="rounded-2xl border p-4" style={card}>
          <p style={{ color: 'var(--theme-error)' }}>{totalsState.message}</p>
        </div>
      </section>
    );
  }

  if (health.kind === 'error') {
    return (
      <section className="mx-auto max-w-3xl px-6 py-14 space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Checkout</h1>
        <div className="rounded-2xl border p-4" style={card}>
          <p style={{ color: 'var(--theme-error)' }}>{health.message}</p>
        </div>
      </section>
    );
  }

  // Loaded:
  const total = totalsState.kind === 'loaded' ? totalsState.totalCents : 0;

  let disabledMsg: string | null = null;
  if (health.kind === 'loaded' && !health.enabled) {
    disabledMsg = 'Payments are currently disabled.';
  } else if (health.kind === 'loaded' && !health.ready) {
    disabledMsg = 'Payments are not ready yet (missing server keys).';
  } else if (pkErr) {
    disabledMsg = pkErr;
  } else if (!stripePromise) {
    disabledMsg = 'Stripe is not initialized.';
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-14 space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Checkout</h1>

      <div className="rounded-2xl border p-6 grid gap-4" style={card}>
        <p className="text-xl opacity-80">
          Total due: <strong>{centsToUsd(total)}</strong>
        </p>
        <CommissionPreview />
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

      // Notify the rest of the app to refresh cart views (server likely cleared cart).
      emit(EV_CART_CHANGED);

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

      <div className="mt-3">
        <span className="text-xs"> Accepted Payment Methods:</span>{''}
        <AcceptedCards size="sm" brands={['visa','mastercard','amex','discover']} />
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
        className="inline-block rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button-yellow)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-60"
      >
        {busy ? 'Processing…' : 'Pay now'}
      </button>
    </form>
  );
}
