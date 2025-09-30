// Client/src/pages/orders/OrderConfirmationPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
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
  const location = useLocation() as { state?: { amountCents?: number; paid?: boolean } };
  const hintedAmount = location?.state?.amountCents;

  // detect paid=1 query param or state.paid
  const showPaidBanner = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('paid') === '1';
    const fromState = location?.state?.paid === true;
    return fromQuery || fromState;
  }, [location?.state?.paid]);

  const [state, setState] = useState<Load>({ kind: 'idle' });

  // Initial fetch: latest order (server creates the Order when /checkout/intent is called)
  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
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

  // Poll for ~60s if the newest order is still pending_payment
  useEffect(() => {
    if (state.kind !== 'loaded') return;             // <- narrow first
    if (!state.order || state.order.status !== 'pending_payment') return;

    let alive = true;
    const startedAt = Date.now();
    const maxMs = 60_000;     // ~1 minute
    const intervalMs = 3_000; // every 3s

    async function tick() {
      if (!alive) return;
      const { data } = await listMyOrders(1, 1);
      if (!alive) return;
      const latest = data?.items?.[0] ?? null;
      if (latest) {
        setState({ kind: 'loaded', order: latest });
        if (latest.status !== 'pending_payment') {
          clearInterval(timer);
        }
      }
      if (Date.now() - startedAt > maxMs) {
        clearInterval(timer);
      }
    }

    const timer = window.setInterval(tick, intervalMs);
    const kick = window.setTimeout(() => { void tick(); }, 1200);

    return () => { alive = false; clearInterval(timer); clearTimeout(kick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind]); // keep deps simple; internal guards read state.order safely

  const card = {
    background: 'var(--theme-surface)',
    borderColor: 'var(--theme-border)',
    color: 'var(--theme-text)',
  } as const;

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

  // Safe: explicitly narrow to loaded/null for render usage
  const order: MyOrderListItem | null = state.kind === 'loaded' ? state.order : null;
  const bannerPaid = showPaidBanner || (order?.status === 'paid');

  return (
    <section className="mx-auto max-w-3xl px-6 py-14 space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Thank you!</h1>

      {bannerPaid ? (
        <div
          className="rounded-2xl border p-4"
          style={{
            background: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text)',
            boxShadow: '0 10px 30px var(--theme-shadow)',
          }}
        >
          <div className="font-semibold">Payment received</div>
          <div className="opacity-80">Your order is confirmed. We’ll email shipping updates.</div>
        </div>
      ) : null}

      <div className="rounded-2xl border p-6 grid gap-3" style={card}>
        <p>Your payment was submitted successfully.</p>
        {order ? (
          <>
            <p><strong>Order #</strong> {order.id}</p>
            <p><strong>Status</strong> {order.status.replace('_', ' ')}</p>
            <p>
              <strong>Total</strong> {centsToUsd(order.totalCents)}
              {typeof hintedAmount === 'number' && hintedAmount !== order.totalCents ? (
                <span className="ml-2 opacity-70">(charged: {centsToUsd(hintedAmount)})</span>
              ) : null}
            </p>

            {/* Print receipt (server HTML) */}
            <div className="mt-4">
              <a
                href={`/orders/${order.id}/receipt`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--theme-border)] px-4 py-2 text-sm hover:bg-[var(--theme-card)]"
              >
                🖨️ Print receipt
              </a>
            </div>
          </>
        ) : (
          <>
            <p><strong>Order #</strong> pending…</p>
            {typeof hintedAmount === 'number' ? <p><strong>Total</strong> {centsToUsd(hintedAmount)}</p> : null}
            <p className="text-sm opacity-80">
              We’re finalizing your order. It will appear in{' '}
              <Link
                to="/account/orders"
                className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
              >
                My Orders
              </Link>{' '}
              shortly.
            </p>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/products"
          className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
        >
          Continue shopping
        </Link>

        {order ? (
          <a
            href={`/orders/${order.id}/receipt`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-xl px-4 py-2 font-semibold border border-[var(--theme-border)] hover:bg-[var(--theme-card)]"
          >
            Print receipt
          </a>
        ) : null}
      </div>
    </section>
  );
}
