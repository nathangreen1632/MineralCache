// Client/src/pages/vendor/PayoutsPage.tsx
import React, { useEffect, useState } from 'react';
import { getMyPayouts, type VendorPayoutRow } from '../../api/vendor';
import { centsToUsd} from "../../utils/money.util.ts";

export default function VendorPayoutsPage(): React.ReactElement {
  const [rows, setRows] = useState<VendorPayoutRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [from, setFrom] = useState<string>(''); // YYYY-MM-DD
  const [to, setTo] = useState<string>('');     // YYYY-MM-DD

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

  useEffect(() => { void load(); }, []);

  const totals = rows.reduce(
    (a, r) => {
      a.gross += r.grossCents || 0;
      a.fee += r.feeCents || 0;
      a.net += r.netCents || 0;
      return a;
    },
    { gross: 0, fee: 0, net: 0 }
  );

  // Export CSV via server endpoint (matches Server route)
  const csvHref = `/api/vendors/me/payouts?${[
    'format=csv',
    from ? `from=${encodeURIComponent(from)}` : '',
    to ? `to=${encodeURIComponent(to)}` : '',
  ]
    .filter(Boolean)
    .join('&')}`;

  return (
    <section className="mx-auto max-w-8xl px-6 py-10 space-y-4">
      <h1 className="text-4xl font-semibold text-[var(--theme-text)]">Payouts</h1>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid">
          <span className="text-sm opacity-80">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg px-3 py-2 ring-1 ring-inset"
          />
        </label>
        <label className="grid">
          <span className="text-sm opacity-80">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg px-3 py-2 ring-1 ring-inset"
          />
        </label>
        <button
          onClick={load}
          disabled={busy}
          className="rounded-lg px-3 py-2 ring-1 ring-inset disabled:opacity-50"
        >
          {busy ? 'Loading…' : 'Apply'}
        </button>
        <a href={csvHref} className="rounded-lg px-3 py-2 ring-1 ring-inset">
          Export CSV
        </a>
      </div>

      {msg ? (
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--theme-border)' }}>
          <span style={{ color: 'var(--theme-error)' }}>{msg}</span>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-x-auto" style={{ borderColor: 'var(--theme-border)' }}>
          <table className="w-full text-sm">
            <thead className="text-left">
            <tr className="border-b" style={{ borderColor: 'var(--theme-border)' }}>
              <th className="px-4 py-3">Paid At</th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Gross</th>
              <th className="px-4 py-3">Fee</th>
              <th className="px-4 py-3">Net</th>
            </tr>
            </thead>
            <tbody>
            {busy && rows.length === 0 ? (
              <tr>
                <td className="px-4 py-3" colSpan={5}>Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-3 opacity-70" colSpan={5}>No payouts.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={`${r.orderId}-${r.vendorId}`}
                  className="border-b last:border-b-3"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <td className="px-4 py-3">{new Date(r.paidAt).toLocaleString()}</td>
                  <td className="px-4 py-3">#{r.orderId}</td>
                  <td className="px-4 py-3">{centsToUsd(r.grossCents)}</td>
                  <td className="px-4 py-3">{centsToUsd(r.feeCents)}</td>
                  <td className="px-4 py-3 font-semibold">{centsToUsd(r.netCents)}</td>
                </tr>
              ))
            )}
            </tbody>
            <tfoot>
            <tr>
              <td className="px-4 py-3 font-semibold">Totals</td>
              <td />
              <td className="px-4 py-3 font-semibold">{centsToUsd(totals.gross)}</td>
              <td className="px-4 py-3 font-semibold">{centsToUsd(totals.fee)}</td>
              <td className="px-4 py-3 font-semibold">{centsToUsd(totals.net)}</td>
            </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
