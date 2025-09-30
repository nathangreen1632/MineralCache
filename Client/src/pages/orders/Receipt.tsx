// Client/src/pages/orders/Receipt.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getMyOrder, type GetOrderRes } from '../../api/orders';

type Load =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; order: GetOrderRes['item'] }
  | { kind: 'error'; message: string };

function centsToUsd(cents: number | undefined) {
  if (typeof cents !== 'number') return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}

export default function Receipt(): React.ReactElement {
  const params = useParams();
  const id = Number(params.id);

  const [state, setState] = useState<Load>({ kind: 'idle' });

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

  const card = {
    background: 'var(--theme-surface)',
    borderColor: 'var(--theme-border)',
    color: 'var(--theme-text)',
  } as const;

  if (state.kind === 'loading' || state.kind === 'idle') {
    return (
      <section className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Receipt</h1>
        <div className="mt-4 h-28 rounded-2xl animate-pulse" style={{ background: 'var(--theme-card)' }} />
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="mx-auto max-w-3xl px-6 py-14 space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Receipt</h1>
        <div className="rounded-2xl border p-4" style={card}>
          <p style={{ color: 'var(--theme-error)' }}>{state.message}</p>
        </div>
      </section>
    );
  }

  const o = state.order;
  const tax = (o as any).taxCents ?? 0;

  return (
    <section className="mx-auto max-w-3xl px-6 py-14 space-y-6 print:px-4 print:py-8">
      {/* Header + print button (hidden when printing) */}
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Receipt</h1>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl px-4 py-2 font-semibold border border-[var(--theme-border)] hover:bg-[var(--theme-card)]"
        >
          Print
        </button>
      </div>

      {/* Order summary */}
      <div className="rounded-2xl border p-6 grid gap-2" style={card}>
        <div className="text-sm opacity-80">Order</div>
        <div className="text-lg font-medium">#{o.id}</div>
        <div className="text-sm opacity-80">
          Placed {o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}
        </div>
        <div className="text-sm">
          <strong>Status:</strong>{' '}
          <span className="capitalize">{o.status.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-2xl border overflow-x-auto" style={card}>
        <table className="w-full text-sm">
          <thead className="text-left">
          <tr className="border-b" style={{ borderColor: 'var(--theme-border)' }}>
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3 text-right">Line Total</th>
          </tr>
          </thead>
          <tbody>
          {o.items.map((it: any) => {
            const key = it.id ?? it.orderItemId ?? it.productId ?? `${it.title}-${it.quantity}-${it.unitPriceCents}`;
            const lineTotal = typeof it.lineTotalCents === 'number'
              ? it.lineTotalCents
              : (Number(it.quantity) || 1) * (Number(it.unitPriceCents) || 0);
            return (
              <tr
                key={key}
                className="border-b last:border-b-0"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <td className="px-4 py-3">{it.title}</td>
                <td className="px-4 py-3">{it.quantity}</td>
                <td className="px-4 py-3">{centsToUsd(it.unitPriceCents)}</td>
                <td className="px-4 py-3 text-right">{centsToUsd(lineTotal)}</td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="rounded-2xl border p-6 grid gap-1 ml-auto w-full max-w-sm" style={card}>
        <div className="flex items-center justify-between">
          <div>Subtotal</div>
          <div>{centsToUsd(o.subtotalCents)}</div>
        </div>
        {/* Vendor shipping lines if present */}
        {Array.isArray((o as any).shippingVendors) && (o as any).shippingVendors.length > 0 ? (
          (o as any).shippingVendors.map(
            (v: { vendorId: number; vendorName?: string | null; label?: string | null; amountCents: number }) => {
              const label =
                v.vendorName ? `Shipping · ${v.vendorName}` :
                  v.label ? `Shipping · ${v.label}` :
                    'Shipping';
              return (
                <div key={`ship-${v.vendorId}`} className="flex items-center justify-between">
                  <div>{label}</div>
                  <div>{centsToUsd(v.amountCents)}</div>
                </div>
              );
            }
          )
        ) : (
          <div className="flex items-center justify-between">
            <div>Shipping</div>
            <div>{centsToUsd(o.shippingCents)}</div>
          </div>
        )}
        {typeof tax === 'number' && tax > 0 ? (
          <div className="flex items-center justify-between">
            <div>Tax</div>
            <div>{centsToUsd(tax)}</div>
          </div>
        ) : null}
        <div className="mt-2 border-t pt-2 flex items-center justify-between" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="text-base font-semibold">Total</div>
          <div className="text-base font-semibold">{centsToUsd(o.totalCents)}</div>
        </div>
      </div>

      {/* Print hints for paper */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white !important; }
          a { text-decoration: none; color: inherit; }
          section { box-shadow: none !important; }
        }
      `}</style>
    </section>
  );
}
