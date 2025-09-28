// Client/src/pages/orders/OrderConfirmationPage.tsx
import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { listMyOrders, type MyOrderListItem } from '../../api/orders';

type Load =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; order: MyOrderListItem | null }
  | { kind: 'error'; message: string };

function centsToUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function OrderConfirmationPage(): React.ReactElement {
  // amount passed from checkout (nice to show even if webhook hasn’t flipped status yet)
  const location = useLocation() as { state?: { amountCents?: number } };
  const hintedAmount = location?.state?.amountCents;

  const [state, setState] = useState<Load>({ kind: 'idle' });

  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
      // Best-effort: grab latest order (server creates the Order when /checkout/intent is called)
      const { data, error } = await listMyOrders(1, 1);
      if (!alive) return;
      if (error) {
        setState({ kind: 'error', message: error });
        return;
      }
      const order = data?.items?.[0] ?? null;
      setState({ kind: 'loaded', order });
    })();
    return () => { alive = false; };
  }, []);

  const card = { background: 'var(--theme-surface)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' } as const;

  if (state.kind === 'loading' || state.kind === 'idle') {
    return (
      <section className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Order confirmed</h1>
        <div className="mt-4 h-28 rounded-2xl animate-pulse" style={{ background: 'var(--theme-card)' }} />
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="mx-auto max-w-3xl px-6 py-14 space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Order confirmed</h1>
        <div className="rounded-2xl border p-4" style={card}>
          <p style={{ color: 'var(--theme-error)' }}>{state.message}</p>
        </div>
      </section>
    );
  }

  const order = state.order;
  return (
    <section className="mx-auto max-w-3xl px-6 py-14 space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Thank you!</h1>

      <div className="rounded-2xl border p-6 grid gap-3" style={card}>
        <p>Your payment was submitted successfully.</p>
        {order ? (
          <>
            <p><strong>Order #</strong> {order.id}</p>
            <p><strong>Status</strong> {order.status.replace('_', ' ')}</p>
            <p>
              <strong>Total</strong> {centsToUsd(order.totalCents)}
              {hintedAmount && hintedAmount !== order.totalCents ? (
                <span className="ml-2 opacity-70">(charged: {centsToUsd(hintedAmount)})</span>
              ) : null}
            </p>
          </>
        ) : (
          <>
            <p><strong>Order #</strong> pending…</p>
            {typeof hintedAmount === 'number' ? <p><strong>Total</strong> {centsToUsd(hintedAmount)}</p> : null}
            <p className="text-sm opacity-80">We’re finalizing your order. It will appear in <Link to="/account/orders" className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]">My Orders</Link> shortly.</p>
          </>
        )}
      </div>

      <div>
        <Link to="/products" className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]">
          Continue shopping
        </Link>
      </div>
    </section>
  );
}
