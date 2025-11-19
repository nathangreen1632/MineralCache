// Client/src/pages/cart/CheckoutPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe, type StripeCardElementOptions } from '@stripe/stripe-js';
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getHealth } from '../../api/health';
import { createCheckoutIntent } from '../../api/checkout';
import { useCartTotals } from '../../hooks/useCartTotals';
import { emit } from '../../lib/eventBus';
import { EV_CART_CHANGED } from '../../lib/events';
import CommissionPreview from '../../components/cart/CommissionPreview.tsx';
import AcceptedCards from '../../components/payment/AcceptedCards.tsx';
import { centsToUsd } from '../../utils/money.util';

type LoadHealth =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; enabled: boolean; ready: boolean }
  | { kind: 'error'; message: string };

type ShippingForm = {
  name: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postal: string;
  country: string;
};

function useCardElementStyle(): StripeCardElementOptions['style'] {
  const [style, setStyle] = useState<StripeCardElementOptions['style']>({
    base: {
      color: '#ffffff',
      iconColor: '#ffffff',
      '::placeholder': { color: '#ffffff' },
    },
    invalid: {
      color: '#df1b41',
      iconColor: '#df1b41',
    },
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    function refresh() {
      const cs = getComputedStyle(root);
      const psycho = (cs.getPropertyValue('--theme-psycho') || '').trim() || '#ffffff';
      const error = (cs.getPropertyValue('--theme-error') || '').trim() || '#df1b41';

      setStyle({
        base: {
          color: psycho,
          iconColor: psycho,
          '::placeholder': { color: psycho },
        },
        invalid: {
          color: error,
          iconColor: error,
        },
      });
    }

    refresh();

    const rootObserver = new MutationObserver(() => {
      refresh();
    });

    rootObserver.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    let bodyObserver: MutationObserver | undefined;
    if (body) {
      bodyObserver = new MutationObserver(() => {
        refresh();
      });
      bodyObserver.observe(body, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
      });
    }

    return () => {
      rootObserver.disconnect();
      if (bodyObserver) bodyObserver.disconnect();
    };
  }, []);

  return style;
}

function useStripePk(): { pk: string | null; error: string | null } {
  const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? null;
  if (typeof pk === 'string' && pk.trim().length > 0) return { pk, error: null };
  return { pk: null, error: 'Missing VITE_STRIPE_PUBLISHABLE_KEY' };
}

export default function CheckoutPage(): React.ReactElement {
  const { state: totalsState } = useCartTotals();

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
    return () => {
      alive = false;
    };
  }, []);

  const { pk, error: pkErr } = useStripePk();
  const stripePromise = useMemo(() => (pk ? loadStripe(pk) : null), [pk]);

  const card = {
    background: 'var(--theme-strip)',
    borderColor: 'var(--theme-border)',
    color: 'var(--theme-text)',
  } as const;

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
      <h1 className="text-4xl font-semibold text-[var(--theme-text)]">Checkout</h1>

      <div className="rounded-2xl border p-6 grid gap-4" style={card}>
        <p className="text-xl opacity-80">
          Total due: <strong>{centsToUsd(total)}</strong>
        </p>
        <CommissionPreview />
        {disabledMsg ? (
          <div className="rounded-xl border px-3 py-2 text-sm" style={card}>
            <p style={{ color: 'var(--theme-error)' }}>
              {disabledMsg}
              {healthErr ? ` (${healthErr})` : ''}
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

  const [shipping, setShipping] = useState<ShippingForm>({
    name: '',
    email: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postal: '',
    country: 'US',
  });

  const cardElementStyle = useCardElementStyle();

  function handleShippingChange(field: keyof ShippingForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setShipping((prev) => ({ ...prev, [field]: value }));
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!stripe || !elements) {
      setMsg('Stripe not ready yet.');
      return;
    }

    if (
      !shipping.name.trim() ||
      !shipping.address1.trim() ||
      !shipping.city.trim() ||
      !shipping.state.trim() ||
      !shipping.postal.trim() ||
      !shipping.country.trim()
    ) {
      setMsg('Please fill in all required shipping fields.');
      return;
    }

    setBusy(true);

    const { data, error, status } = await createCheckoutIntent({
      name: shipping.name.trim(),
      email: shipping.email.trim(),
      phone: shipping.phone.trim(),
      address1: shipping.address1.trim(),
      address2: shipping.address2.trim(),
      city: shipping.city.trim(),
      state: shipping.state.trim(),
      postal: shipping.postal.trim(),
      country: shipping.country.trim().toUpperCase(),
    });

    if (status === 503) {
      setBusy(false);
      setMsg('Payments are currently unavailable. Please try again later.');
      return;
    }

    if (status === 401 || error === 'Unauthorized') {
      setBusy(false);
      setMsg('Please sign in or create a MineralCache account before checking out.');
      return;
    }

    if (error || !data?.clientSecret) {
      setBusy(false);
      setMsg(error || 'Failed to start checkout.');
      return;
    }

    const result = await stripe.confirmCardPayment(data.clientSecret, {
      payment_method: { card: elements.getElement(CardElement)! },
    });

    if (result.error) {
      setBusy(false);
      setMsg(result.error.message || 'Payment failed.');
      return;
    }

    if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
      setBusy(false);

      emit(EV_CART_CHANGED);

      navigate('/orders/confirmation', { state: { amountCents: totalCents } });
      return;
    }

    setBusy(false);
    setMsg(`Payment status: ${result.paymentIntent?.status || 'unknown'}`);
  }

  const cardBox = {
    background: 'var(--theme-border)',
    borderColor: 'var(--theme-border)',
  } as const;

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="rounded-xl border p-4 grid gap-3" style={cardBox}>
        <h2 className="text-lg font-semibold text-[var(--theme-text)]">Shipping address</h2>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-sm" htmlFor="ship-name">
              Full name
            </label>
            <input
              id="ship-name"
              type="text"
              className="w-full rounded-xl border px-3 py-2 outline-none bg-[var(--theme-textbox)] text-[var(--theme-pencil)]"
              value={shipping.name}
              onChange={handleShippingChange('name')}
              required
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm" htmlFor="ship-email">
              Email for receipts
            </label>
            <input
              id="ship-email"
              type="email"
              className="w-full rounded-xl border px-3 py-2 outline-none bg-[var(--theme-textbox)] text-[var(--theme-pencil)]"
              value={shipping.email}
              onChange={handleShippingChange('email')}
            />
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <label className="text-sm" htmlFor="ship-phone">
              Phone
            </label>
            <input
              id="ship-phone"
              type="tel"
              className="w-full rounded-xl border px-3 py-2 outline-none bg-[var(--theme-textbox)] text-[var(--theme-pencil)]"
              value={shipping.phone}
              onChange={handleShippingChange('phone')}
              required
            />
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <label className="text-sm" htmlFor="ship-address1">
              Address line 1
            </label>
            <input
              id="ship-address1"
              type="text"
              className="w-full rounded-xl border px-3 py-2 outline-none bg-[var(--theme-textbox)] text-[var(--theme-pencil)]"
              value={shipping.address1}
              onChange={handleShippingChange('address1')}
              required
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm" htmlFor="ship-address2">
              Address line 2
            </label>
            <input
              id="ship-address2"
              type="text"
              className="w-full rounded-xl border px-3 py-2 outline-none bg-[var(--theme-textbox)] text-[var(--theme-pencil)]"
              value={shipping.address2}
              onChange={handleShippingChange('address2')}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-sm" htmlFor="ship-city">
              City
            </label>
            <input
              id="ship-city"
              type="text"
              className="w-full rounded-xl border px-3 py-2 outline-none bg-[var(--theme-textbox)] text-[var(--theme-pencil)]"
              value={shipping.city}
              onChange={handleShippingChange('city')}
              required
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm" htmlFor="ship-state">
              State / Province
            </label>
            <input
              id="ship-state"
              type="text"
              className="w-full rounded-xl border px-3 py-2 outline-none bg-[var(--theme-textbox)] text-[var(--theme-pencil)]"
              value={shipping.state}
              onChange={handleShippingChange('state')}
              required
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm" htmlFor="ship-postal">
              Postal code
            </label>
            <input
              id="ship-postal"
              type="text"
              className="w-full rounded-xl border px-3 py-2 outline-none bg-[var(--theme-textbox)] text-[var(--theme-pencil)]"
              value={shipping.postal}
              onChange={handleShippingChange('postal')}
              required
            />
          </div>
        </div>

        <div className="grid gap-1">
          <label className="text-sm" htmlFor="ship-country">
            Country
          </label>
          <input
            id="ship-country"
            type="text"
            className="w-full rounded-xl border px-3 py-2 outline-none bg-[var(--theme-textbox)] text-[var(--theme-pencil)]"
            value={shipping.country}
            onChange={handleShippingChange('country')}
            required
          />
        </div>
      </div>

      <div className="rounded-xl border p-3">
        <span className="border-[var(--theme-border)]" style={cardBox}>
          <label className="text-lg font-semibold text-[var(--theme-text)] mb-2 block" htmlFor="card-element">
            Credit/Debit Card
          </label>
        </span>
        <CardElement
          id="card-element"
          options={{
            hidePostalCode: true,
            style: cardElementStyle,
          }}
        />
      </div>

      <div className="mt-3">
        <span className="text-xs"> Accepted Payment Methods:</span>{' '}
        <AcceptedCards size="sm" brands={['visa', 'mastercard', 'amex', 'discover']} />
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
