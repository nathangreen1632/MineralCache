import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMyOrders, type MyOrderListItem } from '../../api/orders';

type Load =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; items: MyOrderListItem[]; total: number }
  | { kind: 'error'; message: string };

function centsToUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function MyOrdersPage(): React.ReactElement {
  const [state, setState] = useState<Load>({ kind: 'idle' });

  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
      const { data, error } = await listMyOrders(1, 50);
      if (!alive) return;
      if (error || !data) {
        setState({ kind: 'error', message: error || 'Failed to load orders' });
        return;
      }
      setState({ kind: 'loaded', items: data.items || [], total: data.total || 0 });
    })();
    return () => { alive = false; };
  }, []);

  const card = { background: 'var(--theme-surface)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' } as const;

  if (state.kind === 'loading' || state.kind === 'idle') {
    return (
      <section className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">My Orders</h1>
        <div className="mt-4 h-28 rounded-2xl animate-pulse" style={{ background: 'var(--theme-card)' }} />
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="mx-auto max-w-4xl px-6 py-14 space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">My Orders</h1>
        <div className="rounded-2xl border p-4" style={card}>
          <p style={{ color: 'var(--theme-error)' }}>{state.message}</p>
        </div>
      </section>
    );
  }

  const items = state.items;

  return (
    <section className="mx-auto max-w-4xl px-6 py-14 space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--theme-text)]">My Orders</h1>
      {items.length === 0 ? (
        <div className="rounded-2xl border p-6" style={card}>
          <p>You don’t have any orders yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl border" style={card}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
              <tr className="border-b" style={{ borderColor: 'var(--theme-border)' }}>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
              </thead>
              <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--theme-border)' }}>
                  <td className="px-4 py-3 font-medium">#{o.id}</td>
                  <td className="px-4 py-3">{fmtDate(o.createdAt)}</td>
                  <td className="px-4 py-3 capitalize">{o.status.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{o.itemCount}</td>
                  <td className="px-4 py-3">{centsToUsd(o.totalCents)}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/account/orders/${o.id}`}
                      className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
