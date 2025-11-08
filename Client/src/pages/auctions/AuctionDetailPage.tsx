// Client/src/pages/auctions/AuctionDetailPage.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { getSocket, auctionRoomName } from '../../helpers/socket.helper';
import {
  getAuction,
  placeBid,
  watchAuction,
  unwatchAuction,
  buyNow,
  type AuctionDto,
  type PlaceBidRes,
} from '../../api/auctions';
import Countdown from '../../components/auctions/Countdown';
import AuctionActions from '../../components/auctions/AuctionActions';
import {centsToUsd} from "../../utils/money.util.ts";

type Flash = { kind: 'info' | 'error' | 'success'; text: string };

export default function AuctionDetailPage(): React.ReactElement | null {
  const params = useParams();
  const id = Number(params?.id ?? 0);

  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const isAuthed = Boolean(user);

  const preload = (location.state as {
    imageUrl?: string | null;
    productTitle?: string | null;
    vendorSlug?: string | null;
  } | null) ?? null;

  const [auction, setAuction] = useState<AuctionDto | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(preload?.imageUrl ?? null);
  const [productTitle, setProductTitle] = useState<string | null>(preload?.productTitle ?? null);
  const [vendorSlug, setVendorSlug] = useState<string | null>(preload?.vendorSlug ?? null);

  const [minNext, setMinNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [proxy, setProxy] = useState<string>('');
  const [watching, setWatching] = useState(false);
  const [buyBusy, setBuyBusy] = useState(false);

  const onBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/auctions', { replace: true });
  }, [navigate]);

  const showFlash = useCallback((f: Flash) => {
    setFlash(f);
    window.setTimeout(() => setFlash(null), 2800);
  }, []);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;

    getAuction(id)
      .then((res) => {
        if (!isMounted) return;

        if (res?.error) {
          setAuction(null);
          return;
        }

        const payload = res.data as {
          data?: AuctionDto & { imageUrl?: string | null; productTitle?: string | null };
        } | null | undefined;

        if (payload?.data) {
          setAuction(payload.data);
          setMinNext(null);

          const extra = payload.data as any;
          if (typeof extra.imageUrl === 'string') setImageUrl(extra.imageUrl);
          if (typeof extra.productTitle === 'string') setProductTitle(extra.productTitle);

          if (!vendorSlug) {
            const vslug =
              extra?.vendorSlug ??
              extra?.product?.vendorSlug ??
              extra?.vendor?.slug ??
              null;
            if (typeof vslug === 'string' && vslug.length > 0) setVendorSlug(vslug);
          }
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
        if (!prev?.endAt) return prev;
        const end = new Date(prev.endAt);
        const nextEnd = new Date(end.getTime() + payload.msExtended);
        return { ...prev, endAt: nextEnd.toISOString() };
      });
    }

    function onOutbid(payload: { auctionId: number; outbidUserId: number; highBidCents: number }) {
      showFlash({ kind: 'info', text: 'You were outbid.' });
      setAuction((prev: AuctionDto | null) => {
        if (!prev) return prev;
        return { ...prev, highBidCents: payload.highBidCents };
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
      if (proxy.trim().length > 0) prox = Math.round(Number(proxy) * 100);
      if (!Number.isFinite(amt) || amt <= 0) {
        showFlash({ kind: 'error', text: 'Enter a valid bid amount.' });
        return;
      }

      setBusy(true);
      try {
        const apiRes = await placeBid({ auctionId: auction.id, amountCents: amt, maxProxyCents: prox });

        const data: any = (apiRes as any)?.data ?? null;
        const httpErr = (apiRes as any)?.error ?? null;

        if (httpErr || (data?.error && !data.data)) {
          const hint =
            Number.isFinite(data?.minNextBidCents) ? Number(data.minNextBidCents) :
              (() => {
                const s = String(data?.error ?? httpErr ?? '');
                const m = RegExp(/(\d[\d,]*(?:\.\d{1,2})?)/).exec(s);
                if (!m) return null;
                const num = Number(String(m[1]).replace(/,/g, ''));
                if (!Number.isFinite(num)) return null;
                return s.includes('$') || String(m[1]).includes('.') ? Math.round(num * 100) : Math.round(num);
              })();

          if (hint && Number.isFinite(hint)) {
            setMinNext(hint);
            showFlash({ kind: 'error', text: `Bid too low. Next minimum is ${centsToUsd(hint)}.` });
          } else {
            showFlash({ kind: 'error', text: 'Bid failed.' });
          }
          return;
        }

        const body = data as PlaceBidRes | null | undefined;
        if (body?.data) {
          setAmount('');
          setProxy('');
          setMinNext(body.data.minNextBidCents);
          setAuction(prev => {
            if (!prev) return prev;
            const nextHigh = Number(body.data.highBidCents ?? prev.highBidCents ?? 0);
            if (typeof prev.highBidCents === 'number' && nextHigh < prev.highBidCents) return prev;
            return {
              ...prev,
              highBidCents: nextHigh,
              highBidUserId: Number(body.data.leaderUserId ?? prev.highBidUserId ?? 0),
            };
          });
          showFlash({
            kind: body.data.youAreLeading ? 'success' : 'info',
            text: body.data.youAreLeading ? 'You are leading!' : 'Bid accepted.',
          });
        } else {
          showFlash({ kind: 'error', text: 'Bid failed.' });
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

  const onBuyNow = useCallback(async () => {
    if (!auction || auction.status !== 'live') return;
    const ok = window.confirm('Buy this item now? This will end the auction immediately.');
    if (!ok) return;

    try {
      setBuyBusy(true);
      const res = await buyNow(auction.id);
      if ((res as any)?.error) {
        showFlash({ kind: 'error', text: 'Buy Now failed.' });
        return;
      }
      const okFlag = (res as any)?.data?.ok === true;
      if (!okFlag) {
        const code = (res as any)?.data?.code ?? 'ERROR';
        showFlash({ kind: 'error', text: `Buy Now failed (${code}).` });
        return;
      }
      showFlash({ kind: 'success', text: 'Purchased via Buy Now.' });
      const reload = await getAuction(auction.id);
      if (!reload?.error) {
        const payload = reload.data as { data?: AuctionDto } | null | undefined;
        if (payload?.data) setAuction(payload.data);
      }
    } finally {
      setBuyBusy(false);
    }
  }, [auction, showFlash]);

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
    minHint = `Minimum next bid: ${centsToUsd(minNext)}`;
  }

  let buttonLabel = 'Place bid';
  if (busy) buttonLabel = 'Placing…';

  const productHref = typeof auction.productId === 'number' ? `/products/${auction.productId}` : null;

  return (
    <main className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-7xl px-6 py-14 grid gap-8">
        <header className="grid gap-2">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--theme-link)] hover:text-[var(--theme-link-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] rounded-lg px-1 py-1"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
          </div>

          <h1 className="text-2xl font-bold flex items-center gap-2">
            {headerTitle}
            {auction.status === 'canceled' && (
              <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-[var(--theme-card)] border border-[var(--theme-border)]">
                Canceled
              </span>
            )}
          </h1>

          {typeof auction.vendorId === 'number' && (
            <div className="flex justify-end">
              <AuctionActions
                auction={{
                  id: auction.id,
                  vendorId: auction.vendorId,
                  status: auction.status,
                  endAt: auction.endAt,
                }}
                onStatusChange={(next) =>
                  setAuction((a) => (a ? { ...a, status: next } : a))
                }
                className="ml-4"
              />
            </div>
          )}

          {vendorSlug ? (
            <div className="text-2xl">
              Sold by:{' '}
              <Link
                to={`/vendors/${vendorSlug}`}
                className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
                aria-label={`View vendor storefront: ${vendorSlug}`}
              >
                {vendorSlug}
              </Link>
            </div>
          ) : null}

          {productTitle && (
            <div className="text-lg text-[var(--theme-muted)]">
              {productHref ? (
                <Link
                  to={productHref}
                  className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
                >
                  {productTitle}
                </Link>
              ) : (
                productTitle
              )}
            </div>
          )}

          <div className="text-lg flex items-center gap-3">
            <span>
              Current: <span className="text-[var(--theme-success)]"><strong>{centsToUsd(display)}</strong>
          </span></span>
            <span>•</span>
            <span>
              Ends in: <Countdown endAt={auction.endAt} />
            </span>
          </div>
        </header>

        {flash && (
          <div role="text" aria-live="polite" className="rounded-xl text-2xl border p-3 border-[var(--theme-border)] bg-[var(--theme-card)]">
            {flash.text}
          </div>
        )}

        <section className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="min-w-0 flex-1 grid gap-3">
            {imageUrl && (
              <div className="overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)]">
                <img
                  src={imageUrl}
                  alt={productTitle ?? headerTitle}
                  className="w-full h-[45rem] object-contain"
                  loading="lazy"
                />
              </div>
            )}

            {productTitle && (
              <div className="text-xl">
                <span className="font-semibold">Item:</span>{' '}
                {productHref ? (
                  <Link
                    to={productHref}
                    className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
                  >
                    {productTitle}
                  </Link>
                ) : (
                  productTitle
                )}
              </div>
            )}
          </div>

          <div className="w-full md:w-[26rem] shrink-0 md:sticky md:top-8">
            <div className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-4 shadow-[0_10px_30px_var(--theme-shadow)] grid gap-4">
              {isAuthed && <h2 className="text-2xl font-semibold">Place a bid</h2>}
              {!isAuthed && <div className="text-lg text-[var(--theme-link)]">Sign in, or create an account, to bid.</div>}
              <form onSubmit={onSubmitBid} className="grid gap-3">
                <div className="grid gap-1">
                  <label htmlFor="amount" className="text-lg">Your bid (USD)</label>
                  <input
                    id="amount"
                    inputMode="decimal"
                    disabled={!isAuthed}
                    placeholder="e.g. $125.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-4 py-2"
                  />
                </div>

                <div className="grid gap-1">
                  <label htmlFor="proxy" className="text-lg">Max proxy (optional)</label>
                  <input
                    id="proxy"
                    inputMode="decimal"
                    disabled={!isAuthed}
                    placeholder="e.g. $200.00"
                    value={proxy}
                    onChange={(e) => setProxy(e.target.value)}
                    className="rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-4 py-2"
                  />
                  {minHint && <p className="text-sm text-[var(--theme-button-yellow)]">{minHint}</p>}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={!isAuthed || busy}
                    className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-60"
                  >
                    {buttonLabel}
                  </button>

                  <button
                    type="button"
                    onClick={toggleWatch}
                    disabled={!isAuthed}
                    className="inline-flex rounded-xl px-4 py-2 font-semibold border border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-[var(--theme-card)]"
                    aria-pressed={watching}
                    aria-label={watching ? 'Remove from watchlist' : 'Add to watchlist'}
                  >
                    {watching ? 'Watching ✓' : 'Watch'}
                  </button>

                  {auction.buyNowCents != null && auction.status === 'live' && (
                    <button
                      type="button"
                      onClick={onBuyNow}
                      disabled={!isAuthed || buyBusy}
                      className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-60"
                    >
                      {buyBusy
                        ? 'Processing…'
                        : `Buy Now (${(auction.buyNowCents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })})`}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
