// Client/src/pages/orders/OrderDetailPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMyOrder, type GetOrderRes, cancelMyOrder } from '../../api/orders';
import {carrierLabel, trackingUrl} from '../../utils/tracking.util';
import ShippedBanner from '../../components/orders/ShippedBanner';
import { centsToUsd } from '../../utils/money.util';

type Load =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; order: GetOrderRes['item'] }
  | { kind: 'error'; message: string };


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
  const hasTax = typeof (o as any).taxCents === 'number' && (o as any).taxCents > 0;

  // --- FIX (L97): provide a compare function for sort() ---
  const firstShipped: string | null = (() => {
    const dates = o.items
      .map((it: any) => it.shippedAt as string | null | undefined)
      .filter((d: string | null | undefined): d is string => Boolean(d));
    if (dates.length === 0) return null;
    dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return dates[0] ?? null;
  })();

  const allDelivered = o.items.length > 0 && o.items.every((it: any) => Boolean(it.deliveredAt));
  // --------------------------------------------------------

  return (
    <section className="mx-auto max-w-8xl px-6 py-14 space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-4xl font-semibold text-[var(--theme-text)]">Order #{o.id}</h1>
        <div className="flex items-center gap-3">
          {/* View Receipt (opens server-rendered HTML in new tab) */}
          <a
            href={`/api/orders/${o.id}/receipt`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl px-4 py-2 font-semibold border border-[var(--theme-border)] hover:bg-[var(--theme-card)]"
          >
            View receipt
          </a>

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

      {!allDelivered && firstShipped ? <ShippedBanner shippedAt={firstShipped} orderId={o.id} /> : null}

      <div className="text-xl rounded-2xl border p-6 grid gap-3" style={card}>
        <p>
          <strong>Status:</strong> <span className="capitalize">{o.status.replace('_', ' ')}</span>
        </p>

        {/* Totals breakdown */}
        <div className="grid gap-1 text-lg">
          <div><strong>Subtotal:</strong> {centsToUsd(o.subtotalCents)}</div>

          {/* Per-vendor shipping lines (if provided) */}
          {Array.isArray((o as any).shippingVendors) && (o as any).shippingVendors.length > 0 && (
            <div className="opacity-90">
              {(o as any).shippingVendors.map(
                (
                  v: { vendorId: number; vendorName?: string | null; label?: string | null; amountCents: number }
                ) => {
                  const name = v.vendorName ?? v.label ?? null;
                  const caption = name ? ` · ${name}` : '';
                  return (
                    <div key={`ship-${v.vendorId}`} className="flex gap-2">
                      <span>Shipping{caption}:</span>
                      <span>{centsToUsd(v.amountCents)}</span>
                    </div>
                  );
                }
              )}
            </div>
          )}

          {/* Legacy single-line shipping (fallback) */}
          {(!(o as any).shippingVendors || (o as any).shippingVendors.length === 0) && (
            <div>
              <strong>Shipping:</strong> {centsToUsd(o.shippingCents)}{' '}
              {o.shippingRuleName ? <span className="opacity-70">({o.shippingRuleName})</span> : null}
            </div>
          )}

          {/* Optional tax */}
          {hasTax && <div><strong>Tax:</strong> {centsToUsd((o as any).taxCents)}</div>}

          <div><strong>Total:</strong> {centsToUsd(o.totalCents)}</div>
        </div>

        {/* Any shipping breakdown rows (kept) */}
        {Array.isArray(o.shippingBreakdown) && o.shippingBreakdown.length > 0 ? (
          <div className="mt-2 text-sm opacity-80">
            {o.shippingBreakdown.map((row) => (
              <div key={`sbr-${row.label}-${row.amountCents}`} className="flex gap-2">
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
            <thead className="text-left text-xl font-medium text-[var(--theme-text)]">
            <tr className="border-b" style={{ borderColor: 'var(--theme-border)' }}>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Line Total</th>
              <th className="px-4 py-3">Fulfillment</th>
            </tr>
            </thead>
            <tbody>
            {o.items.map((it: any) => {
              const tUrl = trackingUrl(it.shipCarrier, it.shipTracking);
              const rowKey: string =
                (it.id as string | number | undefined)?.toString() ??
                `${it.productId ?? 'p'}-${it.vendorId ?? 'v'}-${it.title}`;

              const vendorSlug: string | null =
                it.vendorSlug ?? it.vendor_slug ?? it.vendor?.slug ?? null;

              return (
                <tr
                  key={rowKey}
                  className="border-b last:border-b-0"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <td className="px-4 py-3 text-lg">
                    <div className="flex items-center gap-3">
                      {it.primaryPhotoUrl ? (
                        <img
                          src={it.primaryPhotoUrl}
                          alt={it.title}
                          className="h-10 w-10 rounded-md object-cover"
                          style={{ filter: 'drop-shadow(0 6px 18px var(--theme-shadow))' }}
                        />
                      ) : null}

                      <div className="min-w-0">
                        <div className="font-medium truncate">{it.title}</div>
                        {vendorSlug ? (
                          <div className="text-base opacity-80">Sold by: <span className="text-lg font-semibold text-[var(--theme-link)]">{vendorSlug}</span></div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-lg">{it.quantity}</td>
                  <td className="px-4 py-3 text-lg">{centsToUsd(it.unitPriceCents)}</td>
                  <td className="px-4 py-3 text-lg">{centsToUsd(it.lineTotalCents)}</td>
                  <td className="px-4 py-3 text-lg">
                    {it.shipTracking ? (
                      <div className="flex flex-col gap-0.5">
                        <div>
                          <span className="opacity-80">Carrier:</span> {((it).shipCarrierLabel ?? carrierLabel(it.shipCarrier)) || '—'}
                        </div>
                        <div className="truncate">
                          <span className="opacity-80">Tracking:</span>{' '}
                          {tUrl ? (
                            <a
                              className="underline decoration-dotted"
                              href={tUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {it.shipTracking}
                            </a>
                          ) : (
                            it.shipTracking
                          )}
                        </div>
                        {it.shippedAt && (
                          <div className="opacity-80">
                            Shipped: {new Date(it.shippedAt).toLocaleString()}
                          </div>
                        )}
                        {it.deliveredAt && (
                          <div className="opacity-80">
                            Delivered: {new Date(it.deliveredAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="opacity-60">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
