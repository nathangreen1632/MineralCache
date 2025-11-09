// Client/src/components/vendor/VendorOrdersTab.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { listVendorOrders, type VendorOrderListItem, type OrderStatus } from '../../api/vendor';
import { centsToUsd } from '../../utils/money.util';

type Load =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; items: VendorOrderListItem[]; total: number }
  | { kind: 'error'; message: string };

export default function VendorOrdersTab(): React.ReactElement {
  const [state, setState] = useState<Load>({ kind: 'idle' });
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  const filters = useMemo(
    () => ({
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [status, from, to]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
      const { data, error } = await listVendorOrders(filters);
      if (!alive) return;
      if (error || !data) {
        setState({ kind: 'error', message: error || 'Failed to load orders' });
        return;
      }
      setState({ kind: 'loaded', items: data.items ?? [], total: data.total ?? 0 });
    })();
    return () => { alive = false; };
  }, [filters]);

  const card = { background: 'var(--theme-surface)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' } as const;

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border p-4 grid gap-3 md:grid-cols-4" style={card}>
        <div className="grid gap-1">
          <label className="text-xs opacity-70">Status</label>
          <select
            className="rounded border px-2 py-1 bg-[var(--theme-textbox)]"
            style={{ borderColor: 'var(--theme-border)' }}
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus | '')}
          >
            <option value="">All</option>
            <option value="pending_payment">Pending payment</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs opacity-70">From</label>
          <input
            type="date"
            className="rounded border px-2 py-1 bg-[var(--theme-textbox)]"
            style={{ borderColor: 'var(--theme-border)' }}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs opacity-70">To</label>
          <input
            type="date"
            className="rounded border px-2 py-1 bg-[var(--theme-textbox)]"
            style={{ borderColor: 'var(--theme-border)' }}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-2xl border" style={card}>
        {state.kind === 'error' ? (
          <div className="px-4 py-2 text-sm" style={{ color: 'var(--theme-error)' }}>{state.message}</div>
        ) : null}
        {state.kind === 'idle' || state.kind === 'loading' ? (
          <div className="p-6">
            <div className="h-24 animate-pulse rounded-xl" style={{ background: 'var(--theme-card)' }} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
              <tr className="border-b" style={{ borderColor: 'var(--theme-border)' }}>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
              </tr>
              </thead>
              <tbody>
              {(state.kind === 'loaded' ? state.items : []).map((o) => (
                <tr key={o.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--theme-border)' }}>
                  <td className="px-4 py-3 font-medium">#{o.id}</td>
                  <td className="px-4 py-3">{new Date(o.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 capitalize">{o.status.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{o.itemCount}</td>
                  <td className="px-4 py-3">{centsToUsd(o.totalCents)}</td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
