// Client/src/components/auctions/AuctionPanel.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getAuction, getMinimumBid, placeBid, type AuctionDto } from '../../api/auctions';
import { joinRoom, leaveRoom, on, off } from '../../lib/socket';

function centsToUsd(cents: number | null | undefined): string {
  const n = typeof cents === 'number' ? Math.max(0, Math.trunc(cents)) : 0;
  return `$${(n / 100).toFixed(2)}`;
}

type Props = { auctionId: number };

// Server event payloads we listen for
type TickPayload = { now: string; endsAt: string; remainingSec: number };
type LeadPayload = { highBidCents: number; highBidder?: string | null; minNextBidCents: number };

// Extend the DTO with optional view fields we display live via socket updates
type AuctionView = AuctionDto & {
  highBidder?: string | null;
  minNextBidCents?: number | null;
};

export default function AuctionPanel({ auctionId }: Readonly<Props>): React.ReactElement {
  const [auction, setAuction] = useState<AuctionView | null>(null);
  const [minNext, setMinNext] = useState<number | null>(null);
  const [inputUsd, setInputUsd] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);

  const intervalRef = useRef<number | null>(null);

  async function hydrate() {
    setMsg(null);

    // Your lib/api get() returns { data, error }
    const { data, error } = await getAuction(auctionId);
    if (error || !data?.data) {
      setMsg(error || 'Auction not found');
      return;
    }

    const a = data.data; // AuctionDto
    setAuction(a);

    const min = await getMinimumBid(auctionId);
    if (!min.error && min.data?.minNextBidCents != null) {
      setMinNext(min.data.minNextBidCents);
    }

    // Local fallback timer from endAt (DTO field)
    const endsMs = a.endAt ? new Date(a.endAt).getTime() : Date.now();
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((endsMs - now) / 1000));
      setRemainingSec(diff);
    };
    tick();
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(tick, 1000);
  }

  useEffect(() => {
    void hydrate();

    const room = `auction:${auctionId}`;
    joinRoom(room);

    // Server tick (authoritative)
    const onTick = (p: TickPayload) => {
      if (typeof p?.remainingSec === 'number') {
        setRemainingSec(Math.max(0, Math.trunc(p.remainingSec)));
      }
    };

    const onLead = (p: LeadPayload) => {
      setAuction((prev: AuctionView | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          highBidCents: p.highBidCents,
          highBidder: p.highBidder ?? prev.highBidder,
          minNextBidCents: p.minNextBidCents,
        };
      });
      setMinNext(p.minNextBidCents);
    };

    const onOutbid = () => {
      setMsg('You were outbid.');
      window.setTimeout(() => setMsg(null), 3000);
    };

    on<TickPayload>(`auction:${auctionId}:tick`, onTick);
    on<LeadPayload>(`auction:${auctionId}:lead`, onLead);
    on(`auction:${auctionId}:outbid`, onOutbid);

    return () => {
      leaveRoom(room);
      off(`auction:${auctionId}:tick`, onTick as any);
      off(`auction:${auctionId}:lead`, onLead as any);
      off(`auction:${auctionId}:outbid`, onOutbid as any);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [auctionId]);

  function formattedRemaining(): string {
    if (remainingSec == null) return '—';
    const s = Math.max(0, remainingSec);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0 || d > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    parts.push(`${sec}s`);
    return parts.join(' ');
  }

  const minUsdHint = useMemo(
    () => centsToUsd(minNext ?? auction?.minNextBidCents ?? auction?.highBidCents ?? 0),
    [minNext, auction]
  );

  async function submitBid(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    // Parse USD input → cents
    const raw = inputUsd.trim();
    let cents = 0;
    if (raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n)) {
        cents = Math.round(n * 100);
      } else {
        setBusy(false);
        setMsg('Enter a valid number');
        return;
      }
    } else {
      setBusy(false);
      setMsg('Enter a bid amount');
      return;
    }

    const minCents = minNext ?? auction?.minNextBidCents ?? 0;
    if (cents < minCents) {
      setBusy(false);
      setMsg(`Bid must be at least ${centsToUsd(minCents)}`);
      return;
    }

    // Your API wrapper returns { data, error }
    const res = await placeBid({ auctionId, amountCents: cents });
    setBusy(false);

    if (res.error || !res.data) {
      setMsg(res.error || 'Bid failed');
      return;
    }

    // optimistic clear + success note
    setInputUsd('');
    setMsg('Bid placed!');
    window.setTimeout(() => setMsg(null), 2000);

    // Refresh minimum
    const min = await getMinimumBid(auctionId);
    if (!min.error && min.data?.minNextBidCents != null) {
      setMinNext(min.data.minNextBidCents);
    }
  }

  if (!auction) {
    return (
      <div
        className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6"
        style={{ boxShadow: '0 10px 30px var(--theme-shadow)' }}
      >
        Loading auction…
      </div>
    );
  }

  return (
    <section
      className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6 grid gap-4"
      style={{ boxShadow: '0 10px 30px var(--theme-shadow)' }}
      aria-labelledby={`auction-panel-${auction.id}`}
    >
      <div className="flex items-baseline justify-between">
        <h2 id={`auction-panel-${auction.id}`} className="text-lg font-semibold">Live Auction</h2>
        <div className="text-sm opacity-80">
          Ends in: <span aria-live="polite">{formattedRemaining()}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--theme-border)] p-4">
          <div className="text-xs opacity-70">Current high bid</div>
          <div className="text-2xl font-bold">{centsToUsd(auction.highBidCents)}</div>
          {auction.highBidder ? <div className="text-xs opacity-70 mt-1">by {auction.highBidder}</div> : null}
        </div>
        <div className="rounded-xl border border-[var(--theme-border)] p-4">
          <div className="text-xs opacity-70">Minimum next bid</div>
          <div className="text-xl font-semibold">{minUsdHint}</div>
        </div>
      </div>

      <form onSubmit={submitBid} className="grid gap-3" aria-describedby={`auction-help-${auction.id}`}>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Your bid (USD)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={inputUsd}
            onChange={(e) => setInputUsd(e.target.value)}
            className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
            placeholder={minUsdHint}
            aria-label="Bid amount in US dollars"
          />
        </label>

        <div id={`auction-help-${auction.id}`} className="text-xs opacity-70">
          You must be logged in and 18+ to bid. Minimum next bid shown above.
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-60"
          >
            Place bid
          </button>
          {msg ? <div className="text-sm">{msg}</div> : null}
        </div>
      </form>
    </section>
  );
}
