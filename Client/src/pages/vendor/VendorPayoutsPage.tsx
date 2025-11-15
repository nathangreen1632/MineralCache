// Client/src/pages/vendor/PayoutsPage.tsx
import React, { useEffect, useState } from 'react';
import { getMyPayouts, type VendorPayoutRow } from '../../api/vendor';
import { centsToUsd } from '../../utils/money.util';
import { useAuthStore } from '../../stores/useAuthStore';

function renderPayoutStatus(
  status: VendorPayoutRow['payoutStatus'] | undefined
): string {
  if (!status) return 'Unknown';

  switch (status) {
    case 'pending':
      return 'Pending';
    case 'holding':
      return 'Queued';
    case 'transferred':
      return 'Paid';
    case 'reversed':
      return 'Reversed';
    default:
      return status;
  }
}

export default function VendorPayoutsPage(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const isAdmin = String(user?.role ?? '').toLowerCase() === 'admin';

  const [rows, setRows] = useState<VendorPayoutRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  async function load() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await getMyPayouts({
      from: from || undefined,
      to: to || undefined,
    } as any);
    setBusy(false);
    if (error || !data) {
      setMsg(error || 'Failed to load');
      return;
    }
    setRows((data.items ?? []) as VendorPayoutRow[]);
  }

  async function runNow() {
    if (!isAdmin || running) return;
    setRunning(true);
    setMsg(null);
    try {
      const token = window.localStorage.getItem('token') || '';
      const res = await fetch('/api/admin/payouts/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.message || 'Run failed');
      await load();
      setMsg(
        `Processed ${json.vendorsProcessed ?? 0} vendors, ${json.rowsUpdated ?? 0} rows.`
      );
    } catch (e: any) {
      setMsg(e?.message ?? 'Run failed');
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const aggregates = rows.reduce(
    (acc, r) => {
      const gross = r.vendorGrossCents ?? 0;
      const fee = r.vendorFeeCents ?? 0;
      const net = r.vendorNetCents ?? 0;

      if (r.payoutStatus === 'transferred' || r.payoutStatus === 'reversed') {
        acc.paid.gross += gross;
        acc.paid.fee += fee;
        acc.paid.net += net;
      } else {
        acc.unpaid.gross += gross;
        acc.unpaid.fee += fee;
        acc.unpaid.net += net;
      }

      return acc;
    },
    {
      unpaid: { gross: 0, fee: 0, net: 0 },
      paid: { gross: 0, fee: 0, net: 0 },
    }
  );

  const unpaidTotals = aggregates.unpaid;

  const csvHref = `/api/vendors/me/payouts?${[
    'format=csv',
    from ? `from=${encodeURIComponent(from)}` : '',
    to ? `to=${encodeURIComponent(to)}` : '',
  ]
    .filter(Boolean)
    .join('&')}`;

  return (
    <section
      className="mx-auto max-w-8xl px-6 py-10 space-y-4"
      aria-busy={busy || running}
      aria-live="polite"
    >
      <h1 className="text-4xl font-semibold text-[var(--theme-text)]">Payouts</h1>

      <p className="text-base text-[var(--theme-text)]">
        Current balance:{' '}
        <span className="font-semibold text-xl text-[var(--theme-success)]">
          {centsToUsd(unpaidTotals.net)}
        </span>
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid">
          <span className="text-sm opacity-80">From</span>
          <input
            aria-label="From date"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg px-3 py-2 ring-1 ring-inset ring-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)]"
          />
        </label>
        <label className="grid">
          <span className="text-sm opacity-80">To</span>
          <input
            aria-label="To date"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg px-3 py-2 ring-1 ring-inset ring-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)]"
          />
        </label>
        <button
          onClick={load}
          disabled={busy}
          className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-50"
        >
          {busy ? 'Loading…' : 'Apply'}
        </button>
        <a
          href={csvHref}
          className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-card)] text-[var(--theme-link)] hover:text-[var(--theme-link-hover)] ring-1 ring-inset ring-[var(--theme-border)]"
        >
          Export CSV
        </a>
        {isAdmin && (
          <button
            onClick={runNow}
            disabled={running}
            title="Run payouts now"
            className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-50"
          >
            {running ? 'Running…' : 'Run payouts now'}
          </button>
        )}
      </div>

      {msg ? (
        <div
          className="rounded-2xl border p-4"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <span style={{ color: 'var(--theme-text)' }}>{msg}</span>
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-x-auto"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <table className="w-full text-sm">
            <thead className="text-left">
            <tr
              className="border-b"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <th className="px-4 py-3">Paid At</th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Gross</th>
              <th className="px-4 py-3">Fee</th>
              <th className="px-4 py-3">Net</th>
              <th className="px-4 py-3">Payment Status</th>
            </tr>
            </thead>
            <tbody>
            {busy && rows.length === 0 ? (
              <tr>
                <td className="px-4 py-3" colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-3 opacity-70" colSpan={6}>
                  No payouts.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={`${r.orderId}-${r.vendorId}`}
                  className="border-b last:border-b-3"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <td className="px-4 py-3">
                    {r.paidAt ? new Date(r.paidAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-[var(--theme-link)]">#{r.orderId}</td>
                  <td className="px-4 py-3">
                    {centsToUsd(r.vendorGrossCents ?? 0)}
                  </td>
                  <td className="px-4 py-3">
                    {centsToUsd(r.vendorFeeCents ?? 0)}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {centsToUsd(r.vendorNetCents ?? 0)}
                  </td>
                  <td className="px-4 py-3">
                    {renderPayoutStatus(r.payoutStatus)}
                  </td>
                </tr>
              ))
            )}
            </tbody>
            <tfoot>
            <tr className="border-t border-[var(--theme-border)]">
              <td
                className="px-4 py-3 font-semibold text-left text-lg"
                colSpan={2}
              >
                Totals
              </td>
              <td className="px-4 py-3 font-semibold text-lg text-[var(--theme-success)]">
                {centsToUsd(unpaidTotals.gross)}
              </td>
              <td className="px-4 py-3 font-semibold text-lg text-[var(--theme-error)]">
                {centsToUsd(unpaidTotals.fee)}
              </td>
              <td className="px-4 py-3 font-semibold text-lg text-[var(--theme-success)]">
                {centsToUsd(unpaidTotals.net)}
              </td>
            </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
