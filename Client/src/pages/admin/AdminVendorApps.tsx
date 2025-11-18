// Client/src/pages/admin/AdminVendorApps.tsx
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

type VendorAppPage = {
  items: VendorApp[];
  page: number;
  pageSize: number;
  total: number;
};

export default function AdminVendorApps(): React.ReactElement {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>('pending');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [data, setData] = useState<VendorAppPage>({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
  });

  async function load(p = page) {
    setMsg(null);
    setBusy(true);
    const { data: payload, error, status: http } = await listVendorApps({
      page: p,
      q: q.trim() || undefined,
      status,
    });
    setBusy(false);

    if (error || !payload) {
      setMsg(error ?? `Failed (${http})`);
      return;
    }

    setData({
      items: payload.items,
      page: payload.page,
      pageSize: payload.pageSize,
      total: payload.total,
    });
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q]);

  const totalPages = useMemo(() => {
    const size = data.pageSize || 1;
    const pages = Math.ceil(data.total / size);
    if (!Number.isFinite(pages) || pages <= 0) return 1;
    return pages;
  }, [data.total, data.pageSize]);

  const canPrev = useMemo(() => page > 1, [page]);
  const canNext = useMemo(() => page < totalPages, [page, totalPages]);

  async function approve(id: number) {
    setMsg(null);
    const r = await apiApproveVendor(id);
    if ((r as any).ok) {
      setMsg('Approved.');
      void load(page);
    } else {
      setMsg((r as any).error ?? 'Approval failed.');
    }
  }

  async function reject(id: number) {
    setMsg(null);
    const reason = window.prompt('Reason (required):') ?? undefined;
    const r = await apiRejectVendor(id, reason);
    if ((r as any).ok) {
      setMsg('Rejected.');
      void load(page);
    } else {
      setMsg((r as any).error ?? 'Rejection failed.');
    }
  }

  return (
    <div className="mx-auto max-w-8xl px-4 py-8 space-y-4">
      <h1 className="text-4xl font-semibold text-[var(--theme-text)]">Vendor Applications</h1>

      {msg && (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card-alt)' }}
        >
          {msg}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              void load(1);
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
                onClick={() => {
                  setStatus(s);
                  setPage(1);
                }}
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

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--theme-border)' }}>
        <table
          className="min-w-full text-sm table-fixed"
          style={{ color: 'var(--theme-text)', background: 'var(--theme-surface)' }}
        >
          <thead className="text-left">
          <tr className="border-b" style={{ borderColor: 'var(--theme-border)' }}>
            <th className="px-3 py-2 w-1/2">Vendor</th>
            <th className="px-3 py-2 w-1/5">Email</th>
            <th className="px-3 py-2 w-24">Slug</th>
            <th className="px-3 py-2 w-24">Status</th>
            <th className="px-3 py-2 w-32">Actions</th>
          </tr>
          </thead>
          <tbody>
          {data.items.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-3 py-6 text-center text-xs"
                style={{ color: 'var(--theme-link)' }}
              >
                {busy ? 'Loading…' : 'No results.'}
              </td>
            </tr>
          )}

          {data.items.map((v) => {
            const bioText = (v.bio ?? '').trim();
            const createdAtLabel = v.createdAt
              ? new Date(v.createdAt).toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
              : null;

            return (
              <tr key={v.id} className="border-t" style={{ borderColor: 'var(--theme-border)' }}>
                <td className="px-3 py-2 align-top w-1/2">
                  <div className="font-semibold">{v.displayName}</div>
                  <div className="text-xs" style={{ color: 'var(--theme-link)' }}>
                    #{v.id}
                  </div>
                  {createdAtLabel && (
                    <div className="text-xs" style={{ color: 'var(--theme-link)' }}>
                      APPLIED: <span className="text-[var(--theme-psycho)]">{createdAtLabel}</span>
                    </div>
                  )}
                  {bioText && (
                    <div
                      className="mt-1 text-xs break-words max-w-[60ch]"
                      style={{ color: 'var(--theme-link)' }}
                    >
                      BIO: <span className="text-[var(--theme-psycho)]">{bioText}</span>
                    </div>
                  )}
                  {v.country && (
                    <div className="mt-1 text-xs uppercase" style={{ color: 'var(--theme-link)' }}>
                      Country: <span className="text-[var(--theme-psycho)]">{v.country}</span>
                    </div>
                  )}
                </td>

                <td className="px-3 py-2 w-1/5">
                  <div className="text-sm break-words" style={{ color: 'var(--theme-link)' }}>
                    {v.email ?? '—'}
                  </div>
                </td>

                <td className="px-3 py-2 text-sm whitespace-nowrap w-24">/{v.slug}</td>
                <td className="px-3 py-2 whitespace-nowrap w-24">
                  <StatusPill status={v.approvalStatus} />
                </td>
                <td className="px-3 py-2 w-32">
                  <div className="flex flex-wrap gap-2">
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
            );
          })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs" style={{ color: 'var(--theme-link)' }}>
          Page {data.page} / {totalPages} • {data.total} total
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
            disabled={!canPrev || busy}
            onClick={() => {
              const next = Math.max(1, page - 1);
              setPage(next);
              void load(next);
            }}
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
            disabled={!canNext || busy}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              void load(next);
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
