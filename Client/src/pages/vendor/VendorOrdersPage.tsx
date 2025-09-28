import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

type VendorOrderItem = {
  id: number;
  title?: string;
  qty?: number;
  priceCents?: number;
};

type VendorOrder = {
  id: number;
  status: 'pending' | 'paid' | 'failed' | 'shipped' | 'refunded' | string;
  totalCents: number;
  items?: VendorOrderItem[];
  createdAt?: string;
  updatedAt?: string;
};

function centsToUsd(cents: number | null | undefined): string {
  const n = typeof cents === 'number' ? Math.max(0, Math.trunc(cents)) : 0;
  return `$${(n / 100).toFixed(2)}`;
}

export default function VendorOrdersPage(): React.ReactElement {
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch('/api/vendor/orders');
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.items ?? []);
        if (mounted) setOrders(list as VendorOrder[]);
      } catch (e: any) {
        if (mounted) setErr(e?.message || 'Error loading orders');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-3xl px-6 py-14 grid gap-10">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">My Orders</h1>
        </header>

        <div className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6 shadow-[0_10px_30px_var(--theme-shadow)]">
          {loading && <p>Loading…</p>}
          {!loading && err && <p role="alert">Error: {err}</p>}

          {!loading && !err && orders.length === 0 && (
            <p>No orders yet.</p>
          )}

          {!loading && !err && orders.length > 0 && (
            <ul className="grid gap-4">
              {orders.map(o => {
                const itemCount = o.items?.reduce((n, it) => n + (it.qty || 0), 0) ?? 0;
                return (
                  <li key={o.id} className="grid gap-2 p-4 rounded-xl border border-[var(--theme-border)]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="grid gap-1">
                        <Link
                          to={`/vendor/orders/${o.id}`}
                          className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
                        >
                          Order #{o.id}
                        </Link>
                        <div className="text-sm opacity-80">Status: {o.status}</div>
                        <div className="text-sm opacity-80">
                          Total: {centsToUsd(o.totalCents)} · Items: {itemCount}
                        </div>
                        {o.createdAt ? (
                          <div className="text-xs opacity-60">
                            Placed {new Date(o.createdAt).toLocaleString()}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
