// Client/src/pages/cart/CartPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { getCart, saveCart, type CartItem } from '../../api/cart';
import { on } from '../../lib/eventBus';
import { EV_CART_CHANGED, EV_SHIPPING_CHANGED } from '../../lib/events';
import { useCartTotals } from '../../hooks/useCartTotals';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; items: CartItem[]; subtotal: number; shipping: number; total: number }
  | { kind: 'error'; message: string };

export default function CartPage(): React.ReactElement {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ✅ Use shared totals hook so totals auto-refresh when cart/shipping change elsewhere
  const { state: totalsState } = useCartTotals();

  useEffect(() => {
    let alive = true;

    async function fetchCart() {
      setState({ kind: 'loading' });
      const { data, error, status } = await getCart();
      if (!alive) return;
      if (error || !data) {
        setState({ kind: 'error', message: error || `Failed (${status})` });
        return;
      }
      setState({
        kind: 'loaded',
        items: data.items ?? [],
        subtotal: data.totals?.subtotal ?? 0,
        shipping: data.totals?.shipping ?? 0,
        total: data.totals?.total ?? 0,
      });
    }

    // initial load
    fetchCart();

    // auto-refresh items when cart or shipping changes anywhere in the app
    const offCart = on(EV_CART_CHANGED, fetchCart);
    const offShip = on(EV_SHIPPING_CHANGED, fetchCart);

    return () => {
      alive = false;
      offCart();
      offShip();
    };
  }, []);

  const items = state.kind === 'loaded' ? state.items : [];

  // Prefer totals from the shared hook (server-sourced + auto-refresh).
  // Fall back to the page's local fetch if hook is not yet loaded.
  const totals = useMemo(() => {
    const subtotal = state.kind === 'loaded' ? state.subtotal : 0;
    const shipping = state.kind === 'loaded' ? state.shipping : 0;

    let total = state.kind === 'loaded' ? state.total : 0;
    if (totalsState.kind === 'loaded') {
      total = totalsState.totalCents;
    }

    return { subtotal, shipping, total };
  }, [state, totalsState]);

  function setQty(productId: number, qty: number) {
    if (state.kind !== 'loaded') return;
    const next = state.items.map((it) =>
      it.productId === productId ? { ...it, qty } : it
    );
    setState({ ...state, items: next });
  }

  async function persist() {
    if (state.kind !== 'loaded') return;
    setBusy(true);
    setMsg(null);

    // ✅ Guard undefined qty and use correct API field name `quantity`
    const body = {
      items: state.items.map((i) => ({
        productId: i.productId,
        quantity: Math.max(0, Math.trunc(Number(i.qty ?? 0))),
      })),
    };

    const { error } = await saveCart(body);
    setBusy(false);
    setMsg(error || 'Saved.');
    // No manual refetch — saveCart emits EV_CART_CHANGED which triggers our listener.
  }

  function centsToUsd(cents: number) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  // styles
  const card = { background: 'var(--theme-card)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' } as const;
  const borderOnly = { borderColor: 'var(--theme-border)' } as const;

  if (state.kind === 'loading' || state.kind === 'idle') {
    return (
      <section className="mx-auto max-w-4xl px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Your Cart</h1>
        <div className="h-28 rounded-xl animate-pulse" style={{ background: 'var(--theme-card)' }} />
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="mx-auto max-w-4xl px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Your Cart</h1>
        <div className="rounded-xl border p-4" style={card}>
          <p style={{ color: 'var(--theme-error)' }}>{state.message}</p>
        </div>
      </section>
    );
  }

  // loaded
  return (
    <section className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Your Cart</h1>

      {msg && (
        <div className="rounded-md border px-3 py-2 text-sm" style={{ ...card }}>
          {msg}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-3">
          {items.length === 0 && (
            <div className="rounded-xl border p-4" style={card}>
              Your cart is empty.
            </div>
          )}

          {items.map((it) => (
            <div key={it.productId} className="rounded-xl border p-3 flex items-center gap-3" style={card}>
              <div className="h-16 w-16 rounded-lg bg-[var(--theme-card-alt)] overflow-hidden">
                {it.imageUrl ? <img src={it.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate font-semibold">{it.title}</div>
                <div className="text-sm opacity-80">{centsToUsd(it.priceCents)}</div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <span className="opacity-80">Qty</span>
                <input
                  inputMode="numeric"
                  className="w-16 rounded border px-2 py-1 bg-[var(--theme-textbox)]"
                  style={borderOnly}
                  value={String(it.qty ?? 1)}
                  onChange={(e) =>
                    setQty(it.productId, Math.max(0, Math.trunc(+e.target.value || 0)))
                  }
                />
              </label>
            </div>
          ))}

          {items.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={persist}
                disabled={busy}
                className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
              >
                {busy ? 'Saving…' : 'Save Cart'}
              </button>
              <a
                href="/checkout"
                className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold ring-1 ring-inset"
                style={{ ...borderOnly, background: 'var(--theme-surface)', color: 'var(--theme-text)' }}
              >
                Go to Checkout
              </a>
            </div>
          )}
        </div>

        <aside className="rounded-xl border p-4 space-y-2 h-fit" style={card}>
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{centsToUsd(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Shipping</span>
            <span>{centsToUsd(totals.shipping)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-semibold" style={borderOnly}>
            <span>Total</span>
            <span>{centsToUsd(totals.total)}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
