// Client/src/pages/admin/AdminOrders.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  listAdminOrders,
  adminOrdersCsvUrl,
  type AdminOrderStatus,
  type AdminOrderListItem,
} from '../../api/admin';
import { centsToUsd } from '../../utils/money.util';

type StatusFilter = 'all' | AdminOrderStatus;

function statusClass(status: AdminOrderStatus): string {
  switch (status) {
    case 'cancelled':
      return 'text-[var(--theme-error)]';
    case 'paid':
      return 'text-[var(--theme-success)]';
    case 'pending_payment':
      return 'text-[var(--theme-warning)]';
    case 'refunded':
      return 'text-[var(--theme-refund)]';
    default:
      return '';
  }
}

export default function AdminOrders(): React.ReactElement {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [vendorId, setVendorId] = useState<string>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [page, setPage] = useState(1);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [data, setData] = useState<{
    items: AdminOrderListItem[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>({ items: [], page: 1, pageSize: 15, total: 0, totalPages: 0 });

  const [confirmRefundId, setConfirmRefundId] = useState<number | null>(null);
  const [actBusy, setActBusy] = useState(false);

  const csvHref = useMemo(() => {
    const sort: 'newest' | 'oldest' | 'amount_desc' | 'amount_asc' = 'newest';
    return adminOrdersCsvUrl({
      status,
      vendorId: vendorId || null,
      from: from || null,
      to: to || null,
      sort,
    });
  }, [status, vendorId, from, to]);

  async function load(p = page) {
    setBusy(true);
    setMsg(null);
    const vId = vendorId.trim() ? Number(vendorId.trim()) : undefined;
    const { data: payload, error, status: http } = await listAdminOrders({
      status,
      vendorId: Number.isFinite(vId as number) ? vId : undefined,
      from: from || undefined,
      to: to || undefined,
      page: p,
      pageSize: 15,
    });
    setBusy(false);
    if (error || !payload) {
      setMsg(error ?? `Failed (${http})`);
      return;
    }
    setData(payload);
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, from, to, vendorId]);

  const canPrev = useMemo(() => page > 1, [page]);
  const canNext = useMemo(() => page < (data?.totalPages || 1), [page, data?.totalPages]);

  const card = {
    background: 'var(--theme-surface)',
    color: 'var(--theme-text)',
    borderColor: 'var(--theme-border)',
  } as const;

  async function refundOrder(orderId: number) {
    setActBusy(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const ok = res.ok;
      let body: any = null;
      try {
        body = await res.json();
      } catch {}

      if (!ok) {
        const err = (body && (body.error || body.message)) || `HTTP ${res.status}`;
        setFlash({ kind: 'error', text: `Refund failed: ${err}` });
      } else {
        setFlash({ kind: 'success', text: `Refund issued for order #${orderId}.` });
        await load(page);
      }
    } catch (e: any) {
      setFlash({ kind: 'error', text: `Refund failed: ${e?.message || e || 'Unknown error'}` });
    } finally {
      setActBusy(false);
      setConfirmRefundId(null);
    }
  }

  return (
    <section className="mx-auto max-w-8xl px-6 py-10 space-y-4">
      <h1 className="text-4xl font-semibold text-[var(--theme-text)]">All Customer Orders</h1>

      {flash && (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={card}
          role="text"
          aria-live="polite"
        >
          <span
            style={{
              color: flash.kind === 'success' ? 'var(--theme-success)' : 'var(--theme-error)',
            }}
          >
            {flash.text}
          </span>
        </div>
      )}

      {msg && (
        <div className="rounded-md border px-3 py-2 text-sm" style={card} role="alert">
          <span style={{ color: 'var(--theme-error)' }}>{msg}</span>
        </div>
      )}

      <div className="rounded-2xl border p-4 grid md:grid-cols-4 gap-3" style={card}>
        <div className="grid gap-1">
          <label className="text-xs opacity-70" htmlFor="statusFilter">
            Status
          </label>
          <select
            id="statusFilter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="rounded border px-2 py-1 bg-[var(--theme-textbox)]"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <option value="all">All</option>
            <option value="pending_payment">Pending payment</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        <div className="grid gap-1">
          <label className="text-xs opacity-70" htmlFor="vendorIdFilter">
            Vendor ID
          </label>
          <input
            id="vendorIdFilter"
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            placeholder="e.g. 12"
            className="rounded border px-2 py-1 bg-[var(--theme-textbox)]"
            style={{ borderColor: 'var(--theme-border)' }}
          />
        </div>

        <div className="grid gap-1">
          <label className="text-xs opacity-70" htmlFor="fromDateFilter">
            From (UTC)
          </label>
          <input
            id="fromDateFilter"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded border px-2 py-1 bg-[var(--theme-textbox)]"
            style={{ borderColor: 'var(--theme-border)' }}
          />
        </div>

        <div className="grid gap-1">
          <label className="text-xs opacity-70" htmlFor="toDateFilter">
            To (UTC)
          </label>
          <input
            id="toDateFilter"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border px-2 py-1 bg-[var(--theme-textbox)]"
            style={{ borderColor: 'var(--theme-border)' }}
          />
        </div>

        <div className="md:col-span-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setPage(1);
              void load(1);
            }}
            className="inline-flex rounded-lg px-3 py-2 text-sm font-semibold"
            style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
          >
            Apply filters
          </button>

          <a
            href={csvHref}
            className="inline-flex rounded-lg px-3 py-2 text-sm font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
            target="_blank"
            rel="noreferrer"
          >
            Export CSV
          </a>
        </div>
      </div>

      <div className="rounded-2xl border overflow-x-auto" style={card}>
        {busy ? (
          <div className="p-6">
            <div className="h-24 animate-pulse rounded-xl" style={{ background: 'var(--theme-card)' }} />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left">
            <tr className="border-b" style={{ borderColor: 'var(--theme-border)' }}>
              <th className="px-4 py-3">Order #</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Buyer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Vendors</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3" />
            </tr>
            </thead>
            <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-xs opacity-70">
                  No results.
                </td>
              </tr>
            ) : (
              data.items.map((o: AdminOrderListItem) => {
                const canRefund = o.status === 'paid';

                let buyerLabel = `#${o.buyerId}`;
                if (o.buyerEmail) {
                  buyerLabel = `${o.buyerEmail}`;
                } else if (o.buyerName) {
                  buyerLabel = `${o.buyerName}`;
                }

                let vendorsLabel: string | number;
                if (o.vendorSlugs && o.vendorSlugs.length > 0) {
                  vendorsLabel = o.vendorSlugs.join(', ');
                } else if (typeof o.vendorCount === 'number') {
                  vendorsLabel = o.vendorCount;
                } else {
                  vendorsLabel = '—';
                }

                const statusClasses = statusClass(o.status);

                return (
                  <tr
                    key={o.id}
                    className="border-b last:border-b-0"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <td className="px-4 py-3 font-semibold">#{o.id}</td>
                    <td className="px-4 py-3">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-[var(--theme-link)]">{buyerLabel}</td>
                    <td className={`px-4 py-3 uppercase ${statusClasses}`}>
                      {o.status.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3">{o.itemCount}</td>
                    <td className="px-4 py-3 capitalize">{vendorsLabel}</td>
                    <td className={`px-4 py-3 font-semibold ${statusClasses}`}>
                      {centsToUsd(o.totalCents)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/admin/orders/${o.id}`}
                          className="inline-flex rounded-lg px-3 py-1 text-xs font-semibold ring-1 ring-inset"
                          style={{ borderColor: 'var(--theme-border)' }}
                        >
                          View
                        </a>
                        <button
                          type="button"
                          disabled={!canRefund || actBusy}
                          onClick={() => setConfirmRefundId(o.id)}
                          className="inline-flex rounded-lg px-3 py-1 text-xs font-semibold ring-1 ring-inset disabled:opacity-50"
                          style={{ borderColor: 'var(--theme-border)' }}
                          title={
                            canRefund
                              ? 'Issue full refund'
                              : 'Refund disabled (status not paid)'
                          }
                        >
                          Refund
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy || !canPrev}
          onClick={() => {
            const n = Math.max(1, page - 1);
            setPage(n);
            void load(n);
          }}
          className="inline-flex rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-inset disabled:opacity-60"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          Prev
        </button>
        <div className="text-sm opacity-80">
          Page {data.page} / {Math.max(1, data.totalPages)}
        </div>
        <button
          type="button"
          disabled={busy || !canNext}
          onClick={() => {
            const n = page + 1;
            setPage(n);
            void load(n);
          }}
          className="inline-flex rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-inset disabled:opacity-60"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          Next
        </button>
      </div>

      {confirmRefundId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            role="text"
            aria-label="Close refund dialog"
          />
          <div
            className="relative z-10 w-[min(92vw,440px)] rounded-2xl border p-5 grid gap-3"
            style={card}
            role="text"
            aria-modal="true"
            aria-labelledby="refundDialogTitle"
          >
            <div id="refundDialogTitle" className="text-lg font-semibold">
              Issue refund?
            </div>
            <div className="text-sm opacity-80">
              This will create a full refund for order #{confirmRefundId} and set the
              status to <em>refunded</em>.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRefundId(null)}
                disabled={actBusy}
                className="rounded-lg px-3 py-2 text-sm ring-1 ring-inset disabled:opacity-60"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmRefundId != null) void refundOrder(confirmRefundId);
                }}
                disabled={actBusy}
                className="rounded-lg px-3 py-2 text-sm font-semibold"
                style={{
                  background: 'var(--theme-button)',
                  color: 'var(--theme-text-white)',
                }}
              >
                {actBusy ? 'Refunding…' : 'Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
