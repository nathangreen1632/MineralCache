// Client/src/pages/orders/OrderConfirmationPage.tsx
import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { listMyOrders, type MyOrderListItem } from '../../api/orders';
import { centsToUsd } from '../../utils/money.util';
import {pressBtn} from "../../ui/press.ts";

type Load =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; order: MyOrderListItem | null }
  | { kind: 'error'; message: string };

export default function OrderConfirmationPage(): React.ReactElement {
  const location = useLocation() as { state?: { amountCents?: number } };
  const hintedAmount = location?.state?.amountCents;

  const [state, setState] = useState<Load>({ kind: 'idle' });

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
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (state.kind !== 'loaded') return;
    if (!state.order || state.order.status !== 'pending_payment') return;

    let alive = true;
    const startedAt = Date.now();
    const maxMs = 60_000;
    const intervalMs = 3_000;

    async function tick() {
      if (!alive) return;
      const { data } = await listMyOrders(1, 1);
      if (!alive) return;
      const latest = data?.items?.[0] ?? null;
      if (latest) {
        setState({ kind: 'loaded', order: latest });
        if (latest.status !== 'pending_payment') clearInterval(timer);
      }
      if (Date.now() - startedAt > maxMs) clearInterval(timer);
    }

    const timer = window.setInterval(tick, intervalMs);
    const kick = window.setTimeout(() => {
      void tick();
    }, 1200);

    return () => {
      alive = false;
      clearInterval(timer);
      clearTimeout(kick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind]);

  const card = {
    background: 'var(--theme-surface)',
    borderColor: 'var(--theme-border)',
    color: 'var(--theme-text)',
  } as const;

  if (state.kind === 'loading' || state.kind === 'idle') {
    return (
      <section className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Processing your payment…</h1>
        <div className="mt-4 h-28 rounded-2xl animate-pulse" style={{ background: 'var(--theme-card)' }} />
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="mx-auto max-w-3xl px-6 py-14 space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Payment issue</h1>
        <div className="rounded-2xl border p-4" style={card}>
          <p style={{ color: 'var(--theme-error)' }}>{state.message}</p>
        </div>
      </section>
    );
  }

  const order: MyOrderListItem | null = state.kind === 'loaded' ? state.order : null;
  const isPaid = order?.status === 'paid';

  return (
    <section className="mx-auto max-w-3xl px-6 py-14 space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--theme-text)]">
        {isPaid ? 'Thank you!' : 'Processing your payment…'}
      </h1>

      {isPaid ? (
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
          <div className="opacity-80">Your order is confirmed. We’ll email shipping updates if available.</div>
        </div>
      ) : (
        <div className="rounded-2xl border p-4" style={card}>
          <div className="font-semibold">We’re finalizing your payment.</div>
          <div className="opacity-80">This can take up to a minute. If it doesn’t complete, you can try again from My Orders.</div>
        </div>
      )}

      <div className="rounded-2xl border p-6 grid gap-3" style={card}>
        {order ? (
          <>
            <p>
              <strong>Order #</strong> {order.id}
            </p>
            <p>
              <strong>Status</strong> {order.status.replace('_', ' ')}
            </p>
            <p>
              <strong>Total</strong> {centsToUsd(order.totalCents)}
              {typeof hintedAmount === 'number' && hintedAmount !== order.totalCents ? (
                <span className="ml-2 opacity-70">(charged: {centsToUsd(hintedAmount)})</span>
              ) : null}
            </p>

            <p className="text-sm opacity-80">
              Your order will appear in{' '}
              <Link
                to="/account/orders"
                className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
              >
                My Orders
              </Link>{' '}
              shortly.
            </p>
          </>
        ) : (
          <>
            <p>
              <strong>Order #</strong> pending…
            </p>
            {typeof hintedAmount === 'number' ? (
              <p>
                <strong>Total</strong> {centsToUsd(hintedAmount)}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/products"
          className={pressBtn("inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]")}
        >
          Continue shopping
        </Link>
        {isPaid && order ? (
          <a
            href={`/api/orders/${order.id}/receipt`}
            target="_blank"
            rel="noopener noreferrer"
            className={pressBtn("inline-flex rounded-xl px-4 py-2 font-semibold border border-[var(--theme-border)] hover:bg-[var(--theme-card)]")}
          >
            🖨️ Print receipt
          </a>
        ) : null}
      </div>
    </section>
  );
}
