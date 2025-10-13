// Client/src/pages/auctions/EditAuctionPage.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getAuction, updateAuction, type AuctionDto, type UpdateAuctionInput } from '../../api/auctions';

function centsToStr(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '';
  return (v / 100).toFixed(2);
}
function strToCents(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Math.round(Number(s) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

type Flash = { kind: 'info' | 'error' | 'success'; text: string };

export default function EditAuctionPage(): React.ReactElement | null {
  const { id: idParam } = useParams();
  const id = Number(idParam ?? 0);
  const navigate = useNavigate();

  const [auction, setAuction] = useState<AuctionDto | null>(null);
  const [title, setTitle] = useState('');
  const [starting, setStarting] = useState('');  // USD string
  const [reserve, setReserve] = useState('');    // USD string (optional)
  const [buyNow, setBuyNow] = useState('');      // USD string (optional)
  const [duration, setDuration] = useState<1 | 3 | 5 | 7>(3);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);

  const showFlash = useCallback((f: Flash) => {
    setFlash(f);
    window.setTimeout(() => setFlash(null), 2600);
  }, []);

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    getAuction(id).then((res) => {
      if (!mounted) return;
      if ((res)?.error) {
        showFlash({ kind: 'error', text: 'Could not load auction.' });
        return;
      }
      const payload = (res).data as { data?: AuctionDto } | null | undefined;
      const a = payload?.data ?? null;
      if (!a) {
        showFlash({ kind: 'error', text: 'Auction not found.' });
        return;
      }
      setAuction(a);
      setTitle(a.title ?? `Auction #${a.id}`);
      setStarting(centsToStr(a.startingBidCents));
      setReserve(centsToStr(a.reserveCents));
      setBuyNow(centsToStr((a as any).buyNowCents ?? null));
      // Default duration (won’t change existing end unless server does)
      setDuration(3);
    });

    return () => { mounted = false; };
  }, [id, showFlash]);

  const endPreview = useMemo(() => {
    const days = Number(duration);
    if (!Number.isFinite(days) || days <= 0) return null;
    const when = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return when.toLocaleString();
  }, [duration]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!auction) return;

    const startingCents = strToCents(starting);
    const reserveCents = strToCents(reserve);
    const buyNowCents = strToCents(buyNow);

    if (startingCents == null) {
      showFlash({ kind: 'error', text: 'Starting price must be a valid USD amount.' });
      return;
    }

    const body: UpdateAuctionInput = {
      title: title.trim(),
      startingBidCents: startingCents,
      reserveCents: reserveCents ?? null,
      buyNowCents: buyNowCents ?? null,
      durationDays: duration,
    };

    setBusy(true);
    try {
      const res = await updateAuction(auction.id, body);
      if ((res as any)?.error) {
        showFlash({ kind: 'error', text: 'Update failed.' });
        return;
      }
      const ok = (res as any).data?.ok === true;
      if (!ok) {
        const code = (res as any).data?.code ?? 'ERROR';
        showFlash({ kind: 'error', text: `Update failed (${code}).` });
        return;
      }
      showFlash({ kind: 'success', text: 'Auction updated.' });
      navigate(`/auctions/${auction.id}`, { replace: true });
    } finally {
      setBusy(false);
    }
  }

  function onCancel() {
    if (auction) navigate(`/auctions/${auction.id}`);
    else navigate('/auctions');
  }

  if (!auction) return (
    <main className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-3xl px-6 py-10">Loading…</div>
    </main>
  );

  return (
    <main className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-3xl px-6 py-10 grid gap-6">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--theme-link)] hover:text-[var(--theme-link-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] rounded-lg px-1 py-1"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
        </div>

        <h1 className="text-2xl font-bold">Edit Auction</h1>

        {flash && (
          <div role="text" aria-live="polite" className="rounded-xl border p-3 border-[var(--theme-border)] bg-[var(--theme-card)]">
            {flash.text}
          </div>
        )}

        <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-5">
          <div className="grid gap-1">
            <label htmlFor="title" className="text-lg">Title</label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-4 py-2"
            />
          </div>

          <div className="grid gap-1">
            <label htmlFor="starting" className="text-lg">Starting bid (USD)</label>
            <input
              id="starting"
              inputMode="decimal"
              placeholder="e.g. 100.00"
              value={starting}
              onChange={(e) => setStarting(e.target.value)}
              className="rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-4 py-2"
            />
          </div>

          <div className="grid gap-1">
            <label htmlFor="reserve" className="text-lg">Reserve (optional, USD)</label>
            <input
              id="reserve"
              inputMode="decimal"
              placeholder="e.g. 150.00"
              value={reserve}
              onChange={(e) => setReserve(e.target.value)}
              className="rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-4 py-2"
            />
          </div>

          <div className="grid gap-1">
            <label htmlFor="bin" className="text-lg">Buy Now (optional, USD)</label>
            <input
              id="bin"
              inputMode="decimal"
              placeholder="e.g. 250.00"
              value={buyNow}
              onChange={(e) => setBuyNow(e.target.value)}
              className="rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-4 py-2"
            />
          </div>

          <div className="grid gap-1">
            <label htmlFor="duration" className="text-lg">Duration</label>
            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) as 1 | 3 | 5 | 7)}
              className="rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-4 py-2"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={5}>5 days</option>
              <option value={7}>7 days</option>
            </select>
            {endPreview && (
              <div className="text-sm text-[var(--theme-muted)]">Ends (preview): {endPreview}</div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex rounded-xl px-4 py-2 font-semibold border border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-[var(--theme-card)]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
