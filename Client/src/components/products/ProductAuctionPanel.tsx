// Client/src/components/products/ProductAuctionPanel.tsx
import React, { useEffect, useState } from 'react';
import { getAuction, placeBid } from '../../api/auctions';
import { getSocket } from '../../lib/socket';
import { toast } from 'react-hot-toast';

function centsToUsd(c: number) {
  const n = Math.max(0, Math.trunc(c));
  return `$${(n / 100).toFixed(2)}`;
}

export default function ProductAuctionPanel(props: Readonly<{ auctionId: number }>) {
  const { auctionId } = props;

  const [loading, setLoading] = useState(true);
  const [fatalErr, setFatalErr] = useState<string | null>(null);

  const [msRemaining, setMsRemaining] = useState<number>(0);
  const [highBidCents, setHighBidCents] = useState<number | null>(null);         // ✅ proper value+setter
  const [minNextBidCents, setMinNextBidCents] = useState<number>(0);             // ✅ proper value+setter

  const [amountUsd, setAmountUsd] = useState<string>('');
  const [useProxy, setUseProxy] = useState(false);
  const [proxyUsd, setProxyUsd] = useState<string>('');

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resp = await getAuction(auctionId);
      if (cancelled) return;

      if (resp.error || !resp.data?.data) {
        const msg = resp.error || 'Auction not found';
        setFatalErr(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }

      const a = resp.data.data;
      setHighBidCents(a.highBidCents);
      // UI hint only; server enforces exact ladder
      setMinNextBidCents(a.highBidCents != null ? a.highBidCents + 100 : a.startingBidCents);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [auctionId]);

  // Sockets
  useEffect(() => {
    const socket = getSocket();
    socket.emit('auction:join', { auctionId });

    const onHigh = (ev: any) => {
      if (ev?.auctionId !== auctionId) return;
      setHighBidCents(ev.highBidCents);
      setMinNextBidCents(ev.minNextBidCents);
    };
    const onOutbid = (ev: any) => {
      if (ev?.auctionId !== auctionId) return;
      toast.error('You were outbid.');
    };
    const onTick = (ev: any) => {
      if (ev?.auctionId !== auctionId) return;
      setMsRemaining(ev.msRemaining);
    };

    socket.on('auction:high-bid', onHigh);
    socket.on('auction:outbid', onOutbid);
    socket.on('auction:tick', onTick);

    return () => {
      socket.emit('auction:leave', { auctionId });
      socket.off('auction:high-bid', onHigh);
      socket.off('auction:outbid', onOutbid);
      socket.off('auction:tick', onTick);
    };
  }, [auctionId]);

  function toCents(s: string): number | null {
    const v = Number(s);
    if (!Number.isFinite(v)) return null;
    return Math.max(0, Math.round(v * 100));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const amt = toCents(amountUsd);
    if (amt == null) {
      toast.error('Enter a valid amount');
      return;
    }
    const maxProxy = useProxy ? toCents(proxyUsd) ?? undefined : undefined;

    const p = placeBid({ auctionId, amountCents: amt, maxProxyCents: maxProxy }).then((r) => {
      if (r.error || !r.data?.ok) throw new Error(r.error || 'Bid failed');
      return r;
    });

    try {
      const resp = await toast.promise(p, {
        loading: 'Placing bid…',
        success: (r) => {
          const d = r.data!.data;
          return d.youAreLeading ? 'You are the high bidder' : 'Bid accepted (not leading)';
        },
        error: (err) => err?.message || 'Bid failed',
      });

      const d = resp.data!.data;
      setHighBidCents(d.highBidCents);
      setMinNextBidCents(d.minNextBidCents);
      setAmountUsd('');
      setProxyUsd('');
    } catch {
      // handled by toast.promise
    }
  }

  const mins = Math.floor(msRemaining / 60000);
  const secs = Math.floor((msRemaining % 60000) / 1000);

  const card: React.CSSProperties = {
    background: 'var(--theme-surface)',
    borderColor: 'var(--theme-border)',
    color: 'var(--theme-text)',
  };

  if (loading) {
    return (
      <div className="rounded-2xl border p-4" style={card}>
        Loading auction…
      </div>
    );
  }
  if (fatalErr && !highBidCents) {
    return (
      <div className="rounded-2xl border p-4" style={card}>
        {fatalErr}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-4 grid gap-4" style={card}>
      <div className="flex items-center justify-between">
        <div className="font-semibold">Live Auction</div>
        <div className="text-sm opacity-80">
          {msRemaining > 0 ? `${mins}:${secs.toString().padStart(2, '0')} left` : 'Ended'}
        </div>
      </div>

      <div className="text-lg">
        <span>Current:</span>
        {/* ✅ replace {' '} spacer with structural margin to satisfy Sonar (S6772) */}
        <span className="font-semibold ml-1">
          {highBidCents != null ? centsToUsd(highBidCents) : '—'}
        </span>
      </div>

      <div className="text-sm opacity-80">
        Next minimum: {minNextBidCents > 0 ? centsToUsd(minNextBidCents) : '—'}
      </div>

      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <input
          className="rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
          placeholder="Your bid (USD)"
          inputMode="decimal"
          value={amountUsd}
          onChange={(e) => setAmountUsd(e.target.value)}
        />

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useProxy}
            onChange={(e) => setUseProxy(e.target.checked)}
          />
          Use proxy max
        </label>

        {useProxy && (
          <input
            className="md:col-span-2 rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
            placeholder="Proxy max (USD)"
            inputMode="decimal"
            value={proxyUsd}
            onChange={(e) => setProxyUsd(e.target.value)}
          />
        )}

        <button
          type="submit"
          className="md:col-span-2 inline-flex rounded-xl px-4 py-2 font-semibold"
          style={{
            background: 'var(--theme-button)',
            color: 'var(--theme-text-white)',
          }}
        >
          Place bid
        </button>
      </form>
    </div>
  );
}
