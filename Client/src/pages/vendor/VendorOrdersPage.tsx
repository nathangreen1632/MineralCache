// Client/src/pages/vendor/VendorOrdersPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { listVendorOrders, type VendorOrderListItem, type OrderStatus } from '../../api/vendor';

type Tab = 'paid' | 'shipped' | 'refunded';

function centsToUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function VendorOrdersPage(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('paid');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<VendorOrderListItem[]>([]);
  const [page, setPage] = useState(1);

  const statusParam: OrderStatus | 'shipped' =
    tab === 'paid' ? 'paid' : tab === 'refunded' ? 'refunded' : 'shipped';

  async function load() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await listVendorOrders({ status: statusParam, page, pageSize: 50 });
    setBusy(false);
    if (error || !data) {
      setMsg(error || 'Failed to load');
      return;
    }
    setRows(data.items || []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page]);

  function exportCsv() {
    const headers = ['Order ID', 'Created', 'Status', 'Item Count', 'Total USD'];
    const lines = rows.map((r) =>
      [
        r.id,
        new Date(r.createdAt).toISOString(),
        r.status,
        r.itemCount,
        (r.totalCents / 100).toFixed(2),
      ].join(',')
    );
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor-orders-${tab}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const tabs: Array<{ key: Tab; label: string }> = useMemo(
    () => [
      { key: 'paid', label: 'Paid' },
      { key: 'shipped', label: 'Shipped' },
      { key: 'refunded', label: 'Refunded' },
    ],
    []
  );

  return (
    <section className="mx-auto max-w-5xl px-6 py-10 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Vendor · Orders</h1>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            disabled={busy || rows.length === 0}
            className="rounded-xl px-4 py-2 font-semibold border border-[var(--theme-border)] hover:bg-[var(--theme-card)] disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setPage(1);
              setTab(t.key);
            }}
            className={[
              'rounded-xl px-3 py-1.5 text-sm font-semibold border',
              tab === t.key
                ? 'bg-[var(--theme-card)] border-[var(--theme-border)]'
                : 'border-transparent hover:bg-[var(--theme-surface)]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border overflow-x-auto" style={{ borderColor: 'var(--theme-border)' }}>
        <table className="w-full text-sm">
          <thead>
          <tr className="text-left border-b" style={{ borderColor: 'var(--theme-border)' }}>
            <th className="px-4 py-3">Order</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Items</th>
            <th className="px-4 py-3">Total</th>
          </tr>
          </thead>
          <tbody>
          {busy && rows.length === 0 && (
            <tr>
              <td className="px-4 py-3" colSpan={5}>
                Loading…
              </td>
            </tr>
          )}
          {msg && (
            <tr>
              <td className="px-4 py-3 text-[var(--theme-error)]" colSpan={5}>
                {msg}
              </td>
            </tr>
          )}
          {!busy &&
            !msg &&
            rows.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--theme-border)' }}>
                <td className="px-4 py-3 font-semibold">#{r.id}</td>
                <td className="px-4 py-3">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 capitalize">{r.status.replace('_', ' ')}</td>
                <td className="px-4 py-3">{r.itemCount}</td>
                <td className="px-4 py-3">{centsToUsd(r.totalCents)}</td>
              </tr>
            ))}
          {rows.length === 0 && !busy && !msg && (
            <tr>
              <td className="px-4 py-3 opacity-70" colSpan={5}>
                No orders.
              </td>
            </tr>
          )}
          </tbody>
        </table>
      </div>

      {/* Simple pager */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || busy}
          className="rounded-lg px-3 py-1 text-sm border border-[var(--theme-border)] disabled:opacity-50"
        >
          Prev
        </button>
        <div className="opacity-80 text-sm">Page {page}</div>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={busy}
          className="rounded-lg px-3 py-1 text-sm border border-[var(--theme-border)] disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </section>
  );
}
