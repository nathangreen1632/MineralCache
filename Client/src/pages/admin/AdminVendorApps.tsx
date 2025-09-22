// Client/src/pages/AdminVendorApps.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  listVendorApps,
  approveVendor as apiApproveVendor,
  rejectVendor as apiRejectVendor,
  type VendorApp,
} from '../../api/vendor';

type Status = 'all' | 'pending' | 'approved' | 'rejected';

function statusBg(status: Exclude<Status, 'all'>): string {
  if (status === 'approved') return 'var(--theme-success)';
  if (status === 'pending') return 'var(--theme-warning)';
  return 'var(--theme-error)';
}

function StatusPill({ status }: Readonly<{ status: Exclude<Status, 'all'> }>) {
  const bg = statusBg(status);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset"
      style={{ background: bg, color: 'var(--theme-text)', boxShadow: `0 0 0 1px ${bg} inset` }}
    >
      {status.toUpperCase()}
    </span>
  );
}

export default function AdminVendorApps(): React.ReactElement {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>('pending');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [data, setData] = useState<{
    items: VendorApp[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });

  async function load() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await listVendorApps({
        page,
        q: q.trim() || undefined,
        status,
      });
      setData(res);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[admin] failed to load vendor apps', e);
      setMsg(e?.message ?? 'Failed to load applications.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [page, status]);

  const canPrev = useMemo(() => page > 1, [page]);
  const canNext = useMemo(() => page < (data?.totalPages || 1), [page, data?.totalPages]);

  async function approve(id: number) {
    setMsg(null);
    const r = await apiApproveVendor(id);
    if ((r as any).ok) {
      setMsg('Approved.');
      void load();
    } else {
      setMsg((r as any).error ?? 'Approval failed.');
    }
  }

  async function reject(id: number) {
    setMsg(null);
    const reason = window.prompt('Reason (optional):') ?? undefined; // TODO: replace with modal
    const r = await apiRejectVendor(id, reason);
    if ((r as any).ok) {
      setMsg('Rejected.');
      void load();
    } else {
      setMsg((r as any).error ?? 'Rejection failed.');
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Vendor Applications</h1>

      {/* Message */}
      {msg && (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card-alt)' }}
        >
          {msg}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              void load();
            }
          }}
          placeholder="Search by display name…"
          className="min-w-[240px] rounded-lg border px-3 py-2 text-sm"
          style={{
            background: 'var(--theme-textbox)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text)',
          }}
        />
        <button
          type="button"
          className="rounded-lg px-3 py-2 text-sm font-semibold"
          style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
          onClick={() => {
            setPage(1);
            void load();
          }}
        >
          Search
        </button>

        <div className="ml-auto flex items-center gap-1">
          {(['all', 'pending', 'approved', 'rejected'] as Status[]).map((s) => {
            const active = status === s;
            const bg =
              active && s !== 'all'
                ? statusBg(s)
                : 'var(--theme-surface)';
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className="rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset"
                style={{
                  background: bg,
                  color: 'var(--theme-text)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                {s.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--theme-border)' }}>
        <table
          className="min-w-full text-sm"
          style={{ color: 'var(--theme-text)', background: 'var(--theme-surface)' }}
        >
          <thead className="text-left">
          <tr className="border-b" style={{ borderColor: 'var(--theme-border)' }}>
            <th className="px-3 py-2">Vendor</th>
            <th className="px-3 py-2">Slug</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
          </thead>
          <tbody>
          {data.items.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="px-3 py-6 text-center text-xs"
                style={{ color: 'var(--theme-link)' }}
              >
                {busy ? 'Loading…' : 'No results.'}
              </td>
            </tr>
          )}

          {data.items.map((v) => (
            <tr key={v.id} className="border-t" style={{ borderColor: 'var(--theme-border)' }}>
              <td className="px-3 py-2">
                <div className="font-semibold">{v.displayName}</div>
                <div className="text-xs" style={{ color: 'var(--theme-link)' }}>
                  #{v.id}
                </div>
              </td>
              <td className="px-3 py-2">/{v.slug}</td>
              <td className="px-3 py-2">
                <StatusPill status={v.approvalStatus} />
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1 text-xs font-semibold disabled:opacity-60"
                    style={{ background: 'var(--theme-pill-green)', color: 'var(--theme-text)' }}
                    onClick={() => void approve(v.id)}
                    disabled={v.approvalStatus === 'approved'}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1 text-xs font-semibold disabled:opacity-60"
                    style={{ background: 'var(--theme-pill-orange)', color: 'var(--theme-text)' }}
                    onClick={() => void reject(v.id)}
                    disabled={v.approvalStatus === 'rejected'}
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-xs" style={{ color: 'var(--theme-link)' }}>
          Page {data.page} / {Math.max(1, data.totalPages)} • {data.total} total
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset disabled:opacity-60"
            style={{
              background: 'var(--theme-surface)',
              color: 'var(--theme-text)',
              borderColor: 'var(--theme-border)',
            }}
            disabled={!canPrev}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset disabled:opacity-60"
            style={{
              background: 'var(--theme-surface)',
              color: 'var(--theme-text)',
              borderColor: 'var(--theme-border)',
            }}
            disabled={!canNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
