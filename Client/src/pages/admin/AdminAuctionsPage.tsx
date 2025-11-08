// Client/src/pages/admin/AdminAuctionsPage.tsx
import React, { useEffect, useState } from 'react';
import { listActiveAuctions, type AuctionDto } from '../../api/auctions';
import { centsToUsd } from '../../utils/money.util';

export default function AdminAuctionsPage(): React.ReactElement {
  const [rows, setRows] = useState<AuctionDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setBusy(true);
      const { data, error } = await listActiveAuctions();
      if (!mounted) return;
      setBusy(false);
      if (error) {
        setMsg(error);
        return;
      }
      setRows(data);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-5xl px-6 py-10 grid gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin · Live Auctions</h1>
        </div>

        <div
          className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-4 overflow-x-auto"
          style={{ boxShadow: '0 10px 30px var(--theme-shadow)' }}
        >
          <table className="w-full text-sm">
            <thead>
            <tr className="text-left border-b" style={{ borderColor: 'var(--theme-border)' }}>
              <th className="px-4 py-3">Auction</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Ends</th>
              <th className="px-4 py-3">High Bid</th>
              <th className="px-4 py-3">Min Next</th>
              <th className="px-4 py-3">Status</th>
            </tr>
            </thead>
            <tbody>
            {busy && rows.length === 0 ? (
              <tr>
                <td className="px-4 py-3" colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : null}

            {msg ? (
              <tr>
                <td className="px-4 py-3 text-[var(--theme-error)]" colSpan={6}>
                  {msg}
                </td>
              </tr>
            ) : null}

            {!busy &&
              !msg &&
              rows.map((r) => {
                const minNext =
                  (r as any).minNextBidCents != null
                    ? (r as any).minNextBidCents as number
                    : r.highBidCents ?? r.startingBidCents ?? 0;

                return (
                  <tr key={r.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--theme-border)' }}>
                    <td className="px-4 py-3 font-semibold">#{r.id}</td>
                    <td className="px-4 py-3">{r.title || '—'}</td>
                    <td className="px-4 py-3">{r.endAt ? new Date(r.endAt).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3">{centsToUsd(r.highBidCents)}</td>
                    <td className="px-4 py-3">{centsToUsd(minNext)}</td>
                    <td className="px-4 py-3 capitalize">{r.status}</td>
                  </tr>
                );
              })}

            {rows.length === 0 && !busy && !msg ? (
              <tr>
                <td className="px-4 py-3 opacity-70" colSpan={6}>
                  No live auctions.
                </td>
              </tr>
            ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
