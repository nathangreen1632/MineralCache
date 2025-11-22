// Client/src/pages/admin/AdminOrderDetail.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAdminOrder } from '../../api/admin';
import AdminRefundButton from '../../components/admin/AdminRefundButton';
import { centsToUsd } from '../../utils/money.util';

export default function AdminOrderDetail(): React.ReactElement | null {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [item, setItem] = useState<
    NonNullable<Awaited<ReturnType<typeof getAdminOrder>>['data']>['item'] | null
  >(null);

  async function reload() {
    setBusy(true);
    const { data, error, status } = await getAdminOrder(id);
    setBusy(false);

    if (error || !data) {
      setMsg(error ?? `Failed (${status})`);
      return;
    }

    setMsg(null);
    setItem(data.item);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      setBusy(true);
      const { data, error, status } = await getAdminOrder(id);
      if (!alive) return;

      setBusy(false);
      if (error || !data) {
        setMsg(error ?? `Failed (${status})`);
        return;
      }

      setItem(data.item);
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const card = {
    background: 'var(--theme-surface)',
    color: 'var(--theme-text)',
    borderColor: 'var(--theme-border)',
  } as const;

  if (busy && !item) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-10">
        <div
          className="h-24 animate-pulse rounded-2xl"
          style={{ background: 'var(--theme-card)' }}
        />
      </section>
    );
  }

  if (msg) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-2xl border p-4 text-sm" style={card}>
          <span style={{ color: 'var(--theme-error)' }}>{msg}</span>
        </div>
      </section>
    );
  }

  if (!item) return null;

  return (
    <section className="mx-auto max-w-4xl px-6 py-10 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">
          Order #{item.id}
        </h1>

        <div className="flex items-center gap-3">
          {item.status === 'paid' && (
            <AdminRefundButton orderId={item.id} disabled={busy} />
          )}
          <button
            onClick={reload}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-inset disabled:opacity-50"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            {busy ? 'Refreshing…' : 'Refresh Order'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border p-4 grid gap-2" style={card}>
        <div className="text-sm opacity-80">
          Created: {new Date(item.createdAt).toLocaleString()}
        </div>
        <div className="text-sm">Buyer: {item.buyerName}</div>
        <div className="text-sm capitalize">
          Status: {item.status.replace('_', ' ')}
        </div>
        {typeof item.commissionPct === 'number' ? (
          <div className="text-sm">
            Commission: {item.commissionPct}% (
            {centsToUsd(item.commissionCents ?? 0)})
          </div>
        ) : null}
        {item.paymentIntentId ? (
          <div className="text-sm">PI: {item.paymentIntentId}</div>
        ) : null}

        <div
          className="border-t my-2"
          style={{ borderColor: 'var(--theme-border)' }}
        />

        <div className="grid gap-1">
          <div>
            Subtotal: <strong>{centsToUsd(item.subtotalCents)}</strong>
          </div>
          <div>
            Shipping: <strong>{centsToUsd(item.shippingCents)}</strong>
          </div>
          {/* ✅ NEW: show tax if present */}
          {typeof (item as any).taxCents === 'number' &&
            (item as any).taxCents > 0 && (
              <div>
                Tax:{' '}
                <strong>{centsToUsd((item as any).taxCents)}</strong>
              </div>
            )}
          <div>
            Total: <strong>{centsToUsd(item.totalCents)}</strong>
          </div>
        </div>
      </div>

      {!!item.vendors?.length && (
        <div className="rounded-2xl border p-4" style={card}>
          <h2 className="font-semibold mb-2">Vendors</h2>
          <ul className="grid gap-1 text-sm">
            {item.vendors.map((v) => (
              <li key={v.vendorId} className="flex justify-between capitalize">
                <span>{v.displayName ?? `Vendor #${v.vendorId}`}</span>
                <span>{centsToUsd(v.vendorTotalCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border overflow-x-auto" style={card}>
        <table className="w-full text-sm">
          <thead className="text-left">
          <tr
            className="border-b"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Vendor</th>
            <th className="px-4 py-3">Unit</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Line Total</th>
          </tr>
          </thead>
          <tbody>
          {item.items.map((it) => (
            <tr
              key={`${it.productId}-${it.vendorId}`}
              className="border-b last:border-b-0"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <td className="px-4 py-3">{it.title}</td>
              <td className="px-4 py-3 capitalize">
                {it.vendorName ?? `#${it.vendorId}`}
              </td>
              <td className="px-4 py-3">
                {centsToUsd(it.unitPriceCents)}
              </td>
              <td className="px-4 py-3">{it.quantity}</td>
              <td className="px-4 py-3 font-semibold">
                {centsToUsd(it.lineTotalCents)}
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>

      <div>
        <a
          href="/admin/orders"
          className="inline-flex rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-inset"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          Back to orders
        </a>
      </div>
    </section>
  );
}
