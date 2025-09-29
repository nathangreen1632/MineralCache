// Client/src/pages/orders/OrderDetailPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMyOrder, type GetOrderRes, cancelMyOrder } from '../../api/orders';

type Load =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; order: GetOrderRes['item'] }
  | { kind: 'error'; message: string };

function centsToUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function OrderDetailPage(): React.ReactElement {
  const params = useParams();
  const id = Number(params.id);

  const [state, setState] = useState<Load>({ kind: 'idle' });
  const [actMsg, setActMsg] = useState<string | null>(null);
  const [actBusy, setActBusy] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setState({ kind: 'error', message: 'Invalid order id.' });
      return;
    }
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
      const { data, error } = await getMyOrder(id);
      if (!alive) return;
      if (error || !data?.item) {
        setState({ kind: 'error', message: error || 'Order not found.' });
        return;
      }
      setState({ kind: 'loaded', order: data.item });
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  async function onCancel() {
    if (state.kind !== 'loaded') return;
    setActMsg(null);
    setActBusy(true);
    const r = await cancelMyOrder(Number(state.order.id));
    setActBusy(false);
    if (!r.ok) {
      setActMsg(r.error || 'Failed to cancel');
      return;
    }
    setActMsg('Order canceled.');
    setState({
      kind: 'loaded',
      order: { ...state.order, status: 'cancelled' },
    });
  }

  const card = {
    background: 'var(--theme-surface)',
    borderColor: 'var(--theme-border)',
    color: 'var(--theme-text)',
  } as const;

  if (state.kind === 'loading' || state.kind === 'idle') {
    return (
      <section className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Order</h1>
        <div className="mt-4 h-28 rounded-2xl animate-pulse" style={{ background: 'var(--theme-card)' }} />
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="mx-auto max-w-4xl px-6 py-14 space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Order</h1>
        <div className="rounded-2xl border p-4" style={card}>
          <p style={{ color: 'var(--theme-error)' }}>{state.message}</p>
        </div>
      </section>
    );
  }

  const o = state.order;

  return (
    <section className="mx-auto max-w-4xl px-6 py-14 space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Order #{o.id}</h1>
        <div className="flex items-center gap-3">
          {o.status === 'pending_payment' && (
            <>
              <button
                onClick={onCancel}
                disabled={actBusy}
                className="rounded-xl px-4 py-2 font-semibold border border-[var(--theme-border)] hover:bg-[var(--theme-card)] disabled:opacity-50"
              >
                {actBusy ? 'Cancelling…' : 'Cancel order'}
              </button>
              {actMsg && <div className="text-sm opacity-80">{actMsg}</div>}
            </>
          )}
          <Link
            to="/account/orders"
            className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
          >
            Back to orders
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border p-6 grid gap-3" style={card}>
        <p>
          <strong>Status:</strong> <span className="capitalize">{o.status.replace('_', ' ')}</span>
        </p>
        <p>
          <strong>Subtotal:</strong> {centsToUsd(o.subtotalCents)}
        </p>
        <p>
          <strong>Shipping:</strong> {centsToUsd(o.shippingCents)}{' '}
          {o.shippingRuleName ? <span className="opacity-70">({o.shippingRuleName})</span> : null}
        </p>
        {/* ✅ NEW: show tax when present */}
        {typeof (o as any).taxCents === 'number' && (o as any).taxCents > 0 && (
          <p>
            <strong>Tax:</strong> {centsToUsd((o as any).taxCents)}
          </p>
        )}
        <p>
          <strong>Total:</strong> {centsToUsd(o.totalCents)}
        </p>
        {Array.isArray(o.shippingBreakdown) && o.shippingBreakdown.length > 0 ? (
          <div className="mt-1 text-sm opacity-80">
            {o.shippingBreakdown.map((row, idx) => (
              <div key={idx} className="flex gap-2">
                <span>{row.label}:</span>
                <span>{centsToUsd(row.amountCents)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border" style={card}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
            <tr className="border-b" style={{ borderColor: 'var(--theme-border)' }}>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Line Total</th>
            </tr>
            </thead>
            <tbody>
            {o.items.map((it, idx) => (
              <tr
                key={`${it.productId}-${idx}`}
                className="border-b last:border-b-0"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {it.primaryPhotoUrl ? (
                      <img
                        src={it.primaryPhotoUrl}
                        alt={it.title}
                        className="h-10 w-10 rounded-md object-cover"
                        style={{ filter: 'drop-shadow(0 6px 18px var(--theme-shadow))' }}
                      />
                    ) : null}
                    <span className="font-medium">{it.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3">{it.quantity}</td>
                <td className="px-4 py-3">{centsToUsd(it.unitPriceCents)}</td>
                <td className="px-4 py-3">{centsToUsd(it.lineTotalCents)}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
