// Client/src/components/auctions/AuctionPanel.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getAuction, getMinimumBid, placeBid, type AuctionDto } from '../../api/auctions';
import { useAuthStore } from '../../stores/useAuthStore';
import { getSocket, on, off } from '../../lib/socket';
import { centsToUsd } from '../../utils/money.util';

type Props = { auctionId: number };

type TickPayload = { auctionId: number; msRemaining: number };
type HighBidPayload = {
  auctionId: number;
  highBidCents: number;
  leaderUserId: number;
  minNextBidCents: number;
};
type OutbidPayload = { auctionId: number; outbidUserId: number };

type AuctionView = AuctionDto & {
  minNextBidCents?: number | null;
};

export default function AuctionPanel({ auctionId }: Readonly<Props>): React.ReactElement {
  const [auction, setAuction] = useState<AuctionView | null>(null);
  const [minNext, setMinNext] = useState<number | null>(null);
  const [inputUsd, setInputUsd] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const user = useAuthStore((s) => s.user);
  const isAuthed = Boolean(user);

  const intervalRef = useRef<number | null>(null);

  async function hydrate() {
    setMsg(null);

    const { data, error } = await getAuction(auctionId);
    if (error || !data?.data) {
      setMsg(error || 'Auction not found');
      return;
    }

    const a = data.data as AuctionView;
    setAuction(a);

    const min = await getMinimumBid(auctionId);
    if (!min.error && min.data?.minNextBidCents != null) {
      setMinNext(min.data.minNextBidCents);
    }

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

    const socket = getSocket();
    socket.emit('auction:join', { auctionId });

    const onTick = (p: TickPayload) => {
      if (!p || p.auctionId !== auctionId) return;
      setRemainingSec(Math.max(0, Math.trunc(p.msRemaining / 1000)));
    };

    const onHighBid = (p: HighBidPayload) => {
      if (!p || p.auctionId !== auctionId) return;
      setAuction((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          highBidCents: p.highBidCents,
          highBidUserId: p.leaderUserId,
          minNextBidCents: p.minNextBidCents,
        };
      });
      setMinNext(p.minNextBidCents);
    };

    const onOutbid = (p: OutbidPayload) => {
      if (!p || p.auctionId !== auctionId) return;
      setMsg('You were outbid.');
      window.setTimeout(() => setMsg(null), 3000);
    };

    on<TickPayload>('auction:tick', onTick);
    on<HighBidPayload>('auction:high-bid', onHighBid);
    on<OutbidPayload>('auction:outbid', onOutbid);

    return () => {
      socket.emit('auction:leave', { auctionId });
      off('auction:tick', onTick as any);
      off('auction:high-bid', onHighBid as any);
      off('auction:outbid', onOutbid as any);
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

  const minUsdHint = useMemo(() => {
    const baseCents =
      minNext ??
      auction?.minNextBidCents ??
      (auction?.highBidCents ?? (auction?.startingBidCents ?? 0));
    return centsToUsd(baseCents);
  }, [minNext, auction]);

  async function submitBid(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

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

    const minCents =
      minNext ??
      auction?.minNextBidCents ??
      (auction?.highBidCents ?? (auction?.startingBidCents ?? 0));

    if (cents < minCents) {
      setBusy(false);
      setMsg(`Bid must be at least ${centsToUsd(minCents)}`);
      return;
    }

    const res = await placeBid({ auctionId, amountCents: cents });
    setBusy(false);

    if (res.error || !res.data) {
      setMsg(res.error || 'Bid failed');
      return;
    }

    const payload = res.data.data;
    if (payload) {
      setAuction((prev) =>
        prev
          ? {
            ...prev,
            highBidCents: payload.highBidCents,
            highBidUserId: payload.leaderUserId,
            minNextBidCents: payload.minNextBidCents,
          }
          : prev
      );
      setMinNext(payload.minNextBidCents);
    }

    setInputUsd('');
    setMsg('Bid placed!');
    window.setTimeout(() => setMsg(null), 2000);

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
      style={{ boxShadow: '0 3px 12px var(--theme-shadow-carousel)' }}
      aria-labelledby={`auction-panel-${auction.id}`}
    >
      <div className="flex items-baseline justify-between">
        <h2 id={`auction-panel-${auction.id}`} className="text-lg font-semibold">
          Live Auction
        </h2>
        <div className="text-sm opacity-80">
          Ends in: <span aria-live="polite">{formattedRemaining()}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--theme-border)] p-4">
          <div className="text-xs opacity-70">Current high bid</div>
          <div className="text-2xl font-bold text-[var(--theme-success)]">{centsToUsd(auction.highBidCents)}</div>
        </div>
        <div className="rounded-xl border border-[var(--theme-border)] p-4">
          <div className="text-xs opacity-70">Minimum next bid</div>
          <div className="text-xl font-semibold text-[var(--theme-success)]">{minUsdHint}</div>
        </div>
      </div>

      <form onSubmit={submitBid} className="grid gap-3" aria-describedby={`auction-help-${auction.id}`}>
        {!isAuthed && <div className="text-lg">Sign in to bid.</div>}
        <label className="grid gap-1">
          <span className="text-sm font-medium">Your bid (USD)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            disabled={!isAuthed}
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
            disabled={!isAuthed || busy}
            className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-60"
          >
            Place bid
          </button>
          {msg ? <div className="text-base">{msg}</div> : null}
        </div>
      </form>
    </section>
  );
}
