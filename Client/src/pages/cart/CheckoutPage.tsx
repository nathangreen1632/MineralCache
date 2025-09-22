// Client/src/pages/cart/CheckoutPage.tsx
import React, { useEffect, useState } from 'react';
import { getCart, startCheckout } from '../../api/cart';

type Load =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; total: number }
  | { kind: 'error'; message: string };

export default function CheckoutPage(): React.ReactElement {
  const [state, setState] = useState<Load>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
      const { data, error } = await getCart();
      if (!alive) return;
      if (error || !data) {
        setState({ kind: 'error', message: error || 'Failed to load cart' });
        return;
      }
      setState({ kind: 'loaded', total: data.totals?.total ?? 0 });
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleCheckout() {
    if (state.kind !== 'loaded') return;
    setBusy(true);
    setMsg(null);
    const { data, error, status } = await startCheckout(state.total);
    setBusy(false);

    if (status === 503) {
      // Payments disabled branch (server returns 503)
      setMsg('Payments are currently unavailable. Please try again later.');
      return;
    }

    if (error || !data) {
      setMsg(error || 'Failed to start checkout.');
      return;
    }

    if ('clientSecret' in data) {
      // TODO: integrate Stripe.js; for now just display the token for live testing
      setMsg(`Client secret: ${data.clientSecret}`);
      return;
    }

    // Unexpected shape
    setMsg('Unexpected checkout response.');
  }

  // styles
  const card = { background: 'var(--theme-card)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' } as const;

  if (state.kind === 'loading' || state.kind === 'idle') {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Checkout</h1>
        <div className="mt-3 h-28 rounded-xl animate-pulse" style={{ background: 'var(--theme-card)' }} />
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8 space-y-3">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Checkout</h1>
        <div className="rounded-xl border p-4" style={card}>
          <p style={{ color: 'var(--theme-error)' }}>{state.message}</p>
        </div>
      </section>
    );
  }

  // loaded
  return (
    <section className="mx-auto max-w-3xl px-4 py-8 space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Checkout</h1>

      {msg && (
        <div className="rounded-md border px-3 py-2 text-sm" style={card}>
          {msg}
        </div>
      )}

      <div className="rounded-xl border p-4 space-y-3" style={card}>
        <p>Amount: <strong>${(state.total / 100).toFixed(2)}</strong></p>
        <button
          type="button"
          onClick={handleCheckout}
          disabled={busy || state.total <= 0}
          className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
        >
          {busy ? 'Starting…' : 'Start Checkout'}
        </button>
        {/* TODO(stripe): mount Stripe Elements once keys & backend webhook are fully wired */}
      </div>
    </section>
  );
}
