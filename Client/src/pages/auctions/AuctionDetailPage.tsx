// Client/src/pages/auctions/AuctionDetailPage.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSocket, auctionRoomName } from '../../helpers/socket.helper';
import {
  getAuction,
  placeBid,
  watchAuction,
  unwatchAuction,
  type AuctionDto,
  type PlaceBidRes,
} from '../../api/auctions';
import Countdown from '../../components/auctions/Countdown';

function cents(v: number | null | undefined): string {
  let n = 0;
  if (typeof v === 'number' && Number.isFinite(v)) {
    n = v;
  }
  return `$${(n / 100).toFixed(2)}`;
}

type Flash = { kind: 'info' | 'error' | 'success'; text: string };

export default function AuctionDetailPage(): React.ReactElement | null {
  const params = useParams();
  const id = Number(params?.id ?? 0);

  const [auction, setAuction] = useState<AuctionDto | null>(null);
  const [minNext, setMinNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [proxy, setProxy] = useState<string>('');
  const [watching, setWatching] = useState(false);

  const showFlash = useCallback((f: Flash) => {
    setFlash(f);
    window.setTimeout(() => {
      setFlash(null);
    }, 2800);
  }, []);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;

    getAuction(id)
      .then((res) => {
        if (!isMounted) return;

        // lib/api returns { data, error }; our endpoint returns { data: AuctionDto } as the payload
        if ((res as any)?.error) {
          setAuction(null);
          return;
        }

        const payload = (res as any).data as { data?: AuctionDto } | null | undefined;
        if (payload?.data) {
          setAuction(payload.data);
          setMinNext(null);
        } else {
          setAuction(null);
        }
      })
      .catch(() => {
        if (isMounted) setAuction(null);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  // sockets: join room and listen for updates
  useEffect(() => {
    if (!id) return;

    const s = getSocket();
    const room = auctionRoomName(id);

    function onHighBid(payload: {
      auctionId: number;
      highBidCents: number;
      leaderUserId: number;
      minNextBidCents: number;
    }) {
      setAuction((prev: AuctionDto | null) => {
        if (!prev) return prev;
        const next: AuctionDto = {
          ...prev,
          highBidCents: payload.highBidCents,
          highBidUserId: payload.leaderUserId,
        };
        return next;
      });
      setMinNext(payload.minNextBidCents);
    }

    function onTimeExtended(payload: { auctionId: number; msExtended: number }) {
      const secs = Math.floor(payload.msExtended / 1000);
      showFlash({ kind: 'info', text: `Time extended by ${secs}s due to last-minute bid.` });

      setAuction((prev: AuctionDto | null) => {
        if (!prev) return prev;
        if (!prev.endAt) return prev;

        const end = new Date(prev.endAt);
        const newEnd = new Date(end.getTime() + payload.msExtended);

        const next: AuctionDto = { ...prev, endAt: newEnd.toISOString() };
        return next;
      });
    }

    function onOutbid(payload: { auctionId: number; outbidUserId: number; highBidCents: number }) {
      showFlash({ kind: 'info', text: 'You were outbid.' });

      setAuction((prev: AuctionDto | null) => {
        if (!prev) return prev;
        const next: AuctionDto = { ...prev, highBidCents: payload.highBidCents };
        return next;
      });
    }

    s.emit('room:join', { room }, () => {});
    s.on('auction:high-bid', onHighBid);
    s.on('auction:time-extended', onTimeExtended);
    s.on('auction:outbid', onOutbid);

    return () => {
      s.emit('room:leave', { room }, () => {});
      s.off('auction:high-bid', onHighBid);
      s.off('auction:time-extended', onTimeExtended);
      s.off('auction:outbid', onOutbid);
    };
  }, [id, showFlash]);

  const onSubmitBid = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!auction) return;

      const amt = Math.round(Number(amount) * 100);
      let prox: number | undefined = undefined;

      if (proxy.trim().length > 0) {
        prox = Math.round(Number(proxy) * 100);
      }

      if (!Number.isFinite(amt) || amt <= 0) {
        showFlash({ kind: 'error', text: 'Enter a valid bid amount.' });
        return;
      }

      setBusy(true);
      try {
        const apiRes = await placeBid({
          auctionId: auction.id,
          amountCents: amt,
          maxProxyCents: prox,
        });

        if ((apiRes as any)?.error) {
          showFlash({ kind: 'error', text: 'Bid failed.' });
        } else {
          // apiRes.data is PlaceBidRes; shape: { ok: true, data: {...} }
          const body = (apiRes as any).data as PlaceBidRes | null | undefined;
          if (body?.data) {
            setAmount('');
            setProxy('');
            setMinNext(body.data.minNextBidCents);

            let msg = 'Bid accepted.';
            if (body.data.youAreLeading) {
              msg = 'You are leading!';
            }
            showFlash({ kind: 'success', text: msg });
          } else {
            showFlash({ kind: 'error', text: 'Bid failed.' });
          }
        }
      } catch {
        showFlash({ kind: 'error', text: 'Bid failed. Are you signed in and 18+ verified?' });
      } finally {
        setBusy(false);
      }
    },
    [auction, amount, proxy, showFlash]
  );

  const toggleWatch = useCallback(async () => {
    if (!auction) return;

    try {
      if (watching) {
        await unwatchAuction(auction.id);
        setWatching(false);
        showFlash({ kind: 'info', text: 'Removed from watchlist.' });
      } else {
        await watchAuction(auction.id);
        setWatching(true);
        showFlash({ kind: 'success', text: 'Added to watchlist.' });
      }
    } catch {
      showFlash({ kind: 'error', text: 'Could not update watchlist.' });
    }
  }, [auction, watching, showFlash]);

  if (!auction) return null;

  let headerTitle = `Auction #${id}`;
  if (typeof auction.title === 'string' && auction.title.length > 0) {
    headerTitle = auction.title;
  }

  let display = auction.startingBidCents;
  if (typeof auction.highBidCents === 'number') {
    display = auction.highBidCents;
  }

  let minHint = '';
  if (typeof minNext === 'number') {
    minHint = `Minimum next bid: ${cents(minNext)}`;
  }

  let buttonLabel = 'Place bid';
  if (busy) {
    buttonLabel = 'Placing…';
  }

  return (
    <main className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-3xl px-6 py-14 grid gap-8">
        <header className="grid gap-2">
          <h1 className="text-2xl font-bold">{headerTitle}</h1>
          <div className="text-sm flex items-center gap-3">
            <span>
              Current: <strong>{cents(display)}</strong>
            </span>
            <span>•</span>
            <span>
              Ends in: <Countdown endAt={auction.endAt} />
            </span>
          </div>
        </header>

        {flash && (
          <div
            role="text"
            aria-live="polite"
            className="rounded-xl border p-3 border-[var(--theme-border)] bg-[var(--theme-card)]"
          >
            {flash.text}
          </div>
        )}

        <section className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-4 shadow-[0_10px_30px_var(--theme-shadow)] grid gap-4">
          <h2 className="text-lg font-semibold">Place a bid</h2>
          <form onSubmit={onSubmitBid} className="grid gap-3">
            <div className="grid gap-1">
              <label htmlFor="amount" className="text-sm">
                Your bid (USD)
              </label>
              <input
                id="amount"
                inputMode="decimal"
                placeholder="e.g. 125.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-4 py-2"
              />
            </div>

            <div className="grid gap-1">
              <label htmlFor="proxy" className="text-sm">
                Max proxy (optional)
              </label>
              <input
                id="proxy"
                inputMode="decimal"
                placeholder="e.g. 200.00"
                value={proxy}
                onChange={(e) => setProxy(e.target.value)}
                className="rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-4 py-2"
              />
              {minHint && <p className="text-xs text-[var(--theme-link)]">{minHint}</p>}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-60"
              >
                {buttonLabel}
              </button>

              <button
                type="button"
                onClick={toggleWatch}
                className="inline-flex rounded-xl px-4 py-2 font-semibold border border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-[var(--theme-card)]"
                aria-pressed={watching}
                aria-label={watching ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                {watching ? 'Watching ✓' : 'Watch'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
