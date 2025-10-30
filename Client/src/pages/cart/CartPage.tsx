// Client/src/pages/cart/CartPage.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { getCart, saveCart, type CartItem, removeFromCart } from '../../api/cart';
import { on } from '../../lib/eventBus';
import { EV_CART_CHANGED, EV_SHIPPING_CHANGED } from '../../lib/events';
import { useCartTotals } from '../../hooks/useCartTotals';
import CommissionPreview from "../../components/cart/CommissionPreview.tsx";
import AcceptedCards from "../../components/payment/AcceptedCards.tsx";

type Flash = { kind: 'info' | 'error' | 'success'; text: string };

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; items: CartItem[]; subtotal: number; shipping: number; total: number }
  | { kind: 'error'; message: string };

function centsToUsd(cents: unknown) {
  let n: number;
  if (typeof cents === 'number') n = cents;
  else if (typeof cents === 'string') n = Number(cents);
  else n = 0;
  if (!Number.isFinite(n)) n = 0;
  return `$${(n / 100).toFixed(2)}`;
}

function resolvePriceCents(it: CartItem): number {
  const a = it as any;
  const candidates = [a.priceCents, a.unitPriceCents, a.unit_price_cents, a.unitCents, a.price];
  for (const c of candidates) {
    const n = typeof c === 'string' ? Number(c) : c;
    if (typeof n === 'number' && Number.isFinite(n)) return n;
  }
  return 0;
}

function resolveImageUrl(it: CartItem): string | null {
  const a = it as any;
  const candidates = [a.imageUrl, a.photoUrl, a.thumbnailUrl, a.thumbUrl, a.primaryImageUrl, a.primaryPhotoUrl, a.image];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c;
  }
  return null;
}

/** map flash kind → colored styles (switch/case) */
function flashClasses(kind: Flash['kind']) {
  switch (kind) {
    case 'success':
      return 'border-green-600/40 text-green-700 dark:text-green-400';
    case 'error':
      return 'border-red-600/40 text-red-600 dark:text-red-400';
    case 'info':
    default:
      return 'border-amber-500/40 text-amber-700 dark:text-amber-400';
  }
}

export default function CartPage(): React.ReactElement {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [dirty, setDirty] = useState(false);

  const { state: totalsState } = useCartTotals();

  const showFlash = useCallback((f: Flash) => {
    setFlash(f);
    window.setTimeout(() => setFlash(null), 4000);
  }, []);

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
      setDirty(false);
    }

    fetchCart();

    const offCart = on(EV_CART_CHANGED, fetchCart);
    const offShip = on(EV_SHIPPING_CHANGED, fetchCart);

    return () => {
      alive = false;
      offCart();
      offShip();
    };
  }, []);

  const items = state.kind === 'loaded' ? state.items : [];

  const subtotal = state.kind === 'loaded' ? state.subtotal : 0;
  const shipping = state.kind === 'loaded' ? state.shipping : 0;
  let total = state.kind === 'loaded' ? state.total : 0;
  if (totalsState.kind === 'loaded') total = totalsState.totalCents;
  const totals = { subtotal, shipping, total };

  function setQty(productId: number, qty: number) {
    if (state.kind !== 'loaded') return;
    const next = state.items.map((it) => (it.productId === productId ? { ...it, qty } : it));
    setState({ ...state, items: next });
    if (!dirty) {
      setDirty(true);
      showFlash({ kind: 'info', text: 'Quantity updated. Click "Update Cart" before checkout.' });
    }
  }

  async function persist() {
    if (state.kind !== 'loaded') return;
    setBusy(true);

    const items = state.items.map((i) => {
      const q = Math.max(0, Math.trunc(Number(i.qty ?? 0)));
      return { productId: i.productId, qty: q, quantity: q };
    });

    const body: Parameters<typeof saveCart>[0] = { items };
    const { error } = await saveCart(body);
    setBusy(false);

    if (!error) {
      setDirty(false);
      showFlash({ kind: 'success', text: 'Cart saved.' });
    } else {
      showFlash({ kind: 'error', text: 'Could not save your cart.' });
    }
  }

  async function remove(productId: number) {
    if (busy) return;
    setBusy(true);
    const { error } = await removeFromCart(productId);
    setBusy(false);
    if (error) showFlash({ kind: 'error', text: 'Could not remove item.' });
    else showFlash({ kind: 'success', text: 'Item removed.' });
  }

  function onCheckoutClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (dirty) {
      e.preventDefault();
      showFlash({ kind: 'error', text: 'Please click "Save Cart" before proceeding to checkout.' });
    }
  }

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

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Your Cart</h1>

      <div className="grid gap-6 md:grid-cols-3">
        {/* LEFT column — same width as item cards */}
        <div className="md:col-span-2 space-y-3">
          {/* Flash bar sized to the left column */}
          {flash && (
            <div
              role="text"
              aria-live="polite"
              className={`rounded-xl border p-3 bg-[var(--theme-card)] ${flashClasses(flash.kind)}`}
            >
              {flash.text}
            </div>
          )}

          {items.length === 0 && (
            <div className="rounded-xl border p-4" style={card}>
              Your cart is empty.
            </div>
          )}

          {items.map((it) => {
            const imgSrc = resolveImageUrl(it);
            const priceCents = resolvePriceCents(it);

            return (
              <div key={it.productId} className="rounded-xl border p-3 flex items-center gap-3" style={card}>
                <div className="h-16 w-16 rounded-lg bg-[var(--theme-card-alt)] overflow-hidden">
                  {imgSrc ? (
                    <img src={imgSrc} alt={it.title ?? 'Product image'} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-semibold">{(it as any).title ?? 'Untitled item'}</div>
                  <div className="text-sm opacity-80">{centsToUsd(priceCents)}</div>
                </div>

                <label className="inline-flex items-center gap-2 text-sm">
                  <span className="opacity-80">Qty</span>
                  <input
                    inputMode="numeric"
                    className="w-16 rounded border px-2 py-1 bg-[var(--theme-textbox)]"
                    style={borderOnly}
                    value={String((it as any).qty ?? 1)}
                    onChange={(e) => setQty(it.productId, Math.max(0, Math.trunc(+e.target.value || 0)))}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => remove(it.productId)}
                  disabled={busy}
                  className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-inset disabled:opacity-60"
                  style={{ ...borderOnly, background: 'var(--theme-button-error)', color: 'var(--theme-text)' }}
                  aria-label={`Remove ${it.title ?? 'item'} from cart`}
                >
                  Remove
                </button>
              </div>
            );
          })}

          {items.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={persist}
                disabled={busy}
                className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
              >
                {busy ? 'Updating…' : 'Update Cart'}
              </button>
              <a
                href="/checkout"
                onClick={onCheckoutClick}
                className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold ring-1 ring-inset"
                style={{ ...borderOnly, background: 'var(--theme-surface)', color: 'var(--theme-text)' }}
              >
                Go to Checkout
              </a>
            </div>
          )}
        </div>

        {/* RIGHT column — totals */}
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
          <CommissionPreview />
          <div className="mt-3">
            <span className="text-xs"> Accepted Payment Methods:</span>{''}
            <AcceptedCards size="sm" brands={['visa','mastercard','amex','discover']} />
          </div>
        </aside>

      </div>
    </section>
  );
}
