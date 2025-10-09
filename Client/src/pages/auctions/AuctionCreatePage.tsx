import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createAuction, type CreateAuctionInput } from '../../api/auctions';
import { useAuthStore } from '../../stores/useAuthStore';

function parseProductId(input: string): number | '' {
  if (!input) return '';
  // Accept plain ID
  const n = Number(input);
  if (Number.isFinite(n) && n > 0) return n;
  // Accept URLs like /products/123 or .../products/123/edit
  const m = RegExp(/\/products\/(\d+)(?:\/|$)/i).exec(input);
  if (m?.[1]) return Number(m[1]);
  return '';
}

export default function AuctionCreatePage(): React.ReactElement {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [params] = useSearchParams();

  // Initial product id from ?productId=...
  const initialPid = useMemo(() => {
    const v = Number(params.get('productId') || '');
    return Number.isFinite(v) && v > 0 ? v : '';
  }, [params]);

  const [productId, setProductId] = useState<number | ''>(initialPid);
  const [title, setTitle] = useState('');
  const [startingBidUSD, setStartingBidUSD] = useState<string>(''); // display as dollars
  const [reserveUSD, setReserveUSD] = useState<string>('');         // optional
  const [buyNowUSD, setBuyNowUSD] = useState<string>('');           // optional
  const [durationDays, setDurationDays] = useState<1 | 3 | 5 | 7>(7);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const productLocked = initialPid !== '' && productId === initialPid;

  function dollarsToCents(s: string): number | null {
    if (!s.trim()) return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!user || user.role !== 'vendor') {
      setErr('Vendor account required.');
      return;
    }
    if (productId === '') {
      setErr('Select a product.');
      return;
    }
    if (!title.trim()) {
      setErr('Title is required.');
      return;
    }

    const startingBidCents = dollarsToCents(startingBidUSD) ?? 0;
    const reserveCents = dollarsToCents(reserveUSD);
    const buyNowCents = dollarsToCents(buyNowUSD);

    const payload: CreateAuctionInput = {
      productId: Number(productId),
      title: title.trim(),
      startingBidCents,
      durationDays,
      reserveCents: reserveCents ?? null,
      buyNowCents: buyNowCents ?? null,
      // incrementLadderJson: optional
    };

    setSubmitting(true);
    try {
      const res = await createAuction(payload);
      if ((res as any).error) {
        setErr((res as any).error || 'Could not create auction.');
        return;
      }
      const id = (res as any).data?.id ?? (res as any).id;
      if (id) navigate(`/auctions/${id}`);
      else navigate('/auctions');
    } catch {
      setErr('Could not create auction.');
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || !user || user.role !== 'vendor';

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-[var(--theme-text)]">Create Auction</h1>

      {/* Optional preview for end time */}
      <p className="text-sm text-[var(--theme-muted)] mt-2">
        Preview end time: {new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toLocaleString()}
      </p>

      {err && (
        <div className="mt-4 rounded-xl bg-red-50 text-red-800 border border-red-200 px-3 py-2">
          {err}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        {/* Product selection */}
        <div className="grid gap-2">
          <label htmlFor="Product" className="text-sm font-semibold">Product</label>

          {productLocked ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--theme-border)] px-3 py-2 bg-[var(--theme-surface)]">
                <span className="text-xs uppercase tracking-wide opacity-70">Product ID</span>
                <span className="font-semibold">#{productId}</span>
              </span>
              <Link
                to="/vendor/products"
                className="text-[var(--theme-link)] hover:text-[var(--theme-link-hover)] underline"
              >
                Change
              </Link>
            </div>
          ) : (
            <>
              <input
                type="text"
                inputMode="numeric"
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2"
                value={productId}
                onChange={(e) => setProductId(parseProductId(e.target.value))}
                placeholder="Paste a product URL or enter its ID"
              />
              <div className="text-xs text-[var(--theme-muted)]">
                Tip: open <Link to="/vendor/products" className="underline">Vendor → Products</Link> and click
                “Create auction” on a product to prefill this form automatically.
              </div>
            </>
          )}
        </div>

        <label className="grid gap-1">
          <span className="text-sm font-semibold">Title</span>
          <input
            type="text"
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Auction title"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Starting bid (USD)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2"
              value={startingBidUSD}
              onChange={(e) => setStartingBidUSD(e.target.value)}
              placeholder="e.g. 45.00"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Duration</span>
            <select
              className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2"
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value) as 1 | 3 | 5 | 7)}
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={5}>5 days</option>
              <option value={7}>7 days</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Reserve (optional)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2"
              value={reserveUSD}
              onChange={(e) => setReserveUSD(e.target.value)}
              placeholder="e.g. $100.00"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold">Buy It Now (optional)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2"
              value={buyNowUSD}
              onChange={(e) => setBuyNowUSD(e.target.value)}
              placeholder="e.g. $150.00"
            />
          </label>
        </div>

        <div className="flex gap-3 mt-2">
          <button
            type="submit"
            disabled={disabled}
            className="rounded-xl px-4 py-2 bg-[var(--theme-button)] text-[var(--theme-text-white)]
                       hover:bg-[var(--theme-button-hover)] disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create auction'}
          </button>
          <Link
            to="/vendor/products"
            className="rounded-xl px-4 py-2 border border-[var(--theme-border)]"
          >
            Back to products
          </Link>
        </div>
      </form>
    </div>
  );
}
