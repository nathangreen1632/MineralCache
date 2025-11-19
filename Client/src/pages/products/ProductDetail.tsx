// Client/src/pages/products/ProductDetail.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProduct, type Product } from '../../api/products';
import ImageCarousel from '../../components/products/ImageCarousel';
import AuctionPanel from '../../components/auctions/AuctionPanel';
import { addToCart } from '../../api/cart';
import toast from 'react-hot-toast';
import { centsToUsd } from '../../utils/money.util';
import {pressBtn} from "../../ui/press.ts";

function isSaleActive(p: Product, now = new Date()): boolean {
  if (p.salePriceCents == null) return false;
  const startOk = !p.saleStartAt || new Date(p.saleStartAt) <= now;
  const endOk = !p.saleEndAt || now <= new Date(p.saleEndAt);
  return startOk && endOk;
}

function effectivePriceCents(p: Product): number {
  if (isSaleActive(p)) return p.salePriceCents as number;
  return p.priceCents;
}

function sizeLabel(p: Product): string {
  const parts: string[] = [];
  if (p.lengthCm != null) parts.push(String(p.lengthCm));
  if (p.widthCm != null) parts.push(String(p.widthCm));
  if (p.heightCm != null) parts.push(String(p.heightCm));
  if (parts.length > 0) return `${parts.join(' × ')} cm`;
  if (p.sizeNote) return p.sizeNote;
  return '—';
}

function weightLabel(p: Product): string {
  if (p.weightG != null) return `${p.weightG} g`;
  if (p.weightCt != null) return `${p.weightCt} ct`;
  return '—';
}

function fluorescenceLabel(p: Product): string {
  if (!p.fluorescenceMode || p.fluorescenceMode === 'none') return '—';
  let out = p.fluorescenceMode;
  if (p.fluorescenceColorNote) out += ` (${p.fluorescenceColorNote})`;
  return out;
}

const CONDITION_LABELS: Record<string, string> = {
  pristine: 'Pristine',
  minor_damage: 'Minor Damage',
  repaired: 'Repaired',
  restored: 'Restored',
};

function conditionLabel(v: string | null | undefined): string {
  if (!v) return '—';
  return CONDITION_LABELS[v] ?? v;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; product: Product }
  | { kind: 'error'; message: string };

export default function ProductDetail(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const pid = Number(id);
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(pid) || pid <= 0) {
      setState({ kind: 'error', message: 'Invalid product id' });
      return;
    }
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
      try {
        const { data, error, status } = await getProduct(pid);
        if (!alive) return;
        if (error || !data?.product) {
          setState({ kind: 'error', message: error || `Not found (${status})` });
          return;
        }
        setState({ kind: 'loaded', product: data.product });
      } catch (e: any) {
        if (!alive) return;
        setState({ kind: 'error', message: e?.message || 'Failed to load product' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [pid]);

  const images: string[] = useMemo(() => {
    if (state.kind !== 'loaded') return [];
    const p: any = state.product;
    const fromArray =
      (Array.isArray(p.images) &&
        p.images
          .map((x: any) => x?.url1600 || x?.url800 || x?.url320 || x?.url)
          .filter(Boolean)) ||
      (Array.isArray(p.photos) &&
        p.photos
          .map((x: any) => x?.url1600 || x?.url800 || x?.url320 || x?.url)
          .filter(Boolean)) ||
      [];
    const singletons = [p.primaryImageUrl, p.imageUrl, p.mainImageUrl].filter(Boolean) as string[];
    return Array.from(new Set<string>([...singletons, ...fromArray]));
  }, [state]);

  const card: React.CSSProperties = {
    background: 'var(--theme-card)',
    borderColor: 'var(--theme-border)',
    color: 'var(--theme-text)',
  };

  if (state.kind === 'loading' || state.kind === 'idle') {
    return (
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="h-64 rounded-lg animate-pulse" style={card} />
        <div className="mt-4 h-6 w-1/2 rounded animate-pulse" style={card} />
      </section>
    );
  }
  if (state.kind === 'error') {
    return (
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div
          className="rounded-md border p-4 text-sm"
          style={{ ...card, background: 'var(--theme-card-alt)' }}
        >
          {state.message}
        </div>
      </section>
    );
  }

  const p = state.product;
  const onSaleNow = isSaleActive(p);
  const effCents = effectivePriceCents(p);

  let priceEl: React.ReactNode = <span>{centsToUsd(effCents)}</span>;
  if (onSaleNow) {
    priceEl = (
      <>
        <span className="font-bold text-[var(--theme-success)]">{centsToUsd(effCents)}</span>
        <span className="ml-2 line-through text-[var(--theme-button)] opacity-80">
          {centsToUsd(p.priceCents)}
        </span>
      </>
    );
  }

  const auctionId =
    typeof (p as any).auctionId === 'number' && (p as any).auctionId > 0
      ? ((p as any).auctionId as number)
      : undefined;

  const auctionStatusRaw = (p as any).auctionStatus;
  const auctionStatus =
    typeof auctionStatusRaw === 'string' ? (auctionStatusRaw) : null;
  const auctionActive = auctionId != null && (auctionStatus === 'live' || auctionStatus === 'scheduled');

  const categoryName =
    (p as any).categoryName ||
    (p as any).category?.name ||
    null;

  return (
    <section className="mx-auto max-w-8xl px-4 py-8 grid gap-6 lg:grid-cols-2">
      <div className="relative">
        <ImageCarousel images={images} label="Product images" />
        {onSaleNow && (
          <span
            className="absolute left-3 top-3 inline-flex items-center rounded-full px-2 py-0.5 text-base font-semibold shadow"
            style={{ background: 'var(--theme-button-yellow)', color: 'var(--theme-text-black)' }}
            aria-label="On sale"
          >
            On Sale
          </span>
        )}
      </div>

      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">{p.title}</h1>

        <div className="text-lg" style={{ color: 'var(--theme-link)' }}>
          {categoryName}
          {p.locality ? ` ${p.locality}` : ''}
        </div>

        <div className="mt-0.5 text-lg text-[var(--theme-text)]">
          <span className="opacity-75">Sold by:</span>{' '}
          {(p as any).vendorSlug ? (
            <Link
              to={`/vendors/${(p as any).vendorSlug}`}
              className="capitalize underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
              aria-label={`View vendor storefront: ${(p as any).vendorSlug}`}
            >
              {(p as any).vendorSlug}
            </Link>
          ) : null}
        </div>

        <div className="text-xl font-bold text-[var(--theme-success)]">{priceEl}</div>

        {auctionId ? <AuctionPanel auctionId={auctionId} /> : null}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="opacity-80">Size</dt>
          <dd>{sizeLabel(p)}</dd>

          <dt className="opacity-80">Weight</dt>
          <dd>{weightLabel(p)}</dd>

          <dt className="opacity-80">Species</dt>
          <dd>{p.species || '—'}</dd>

          <dt className="opacity-80">Condition</dt>
          <dd>{conditionLabel((p as any).condition)}</dd>

          <dt className="opacity-80">Provenance</dt>
          <dd>{p.provenanceNote ?? '—'}</dd>

          <dt className="opacity-80">Synthetic</dt>
          <dd>{p.synthetic ? 'Yes' : 'No'}</dd>

          <dt className="opacity-80">Fluorescence</dt>
          <dd>{fluorescenceLabel(p)}</dd>

          <dt className="opacity-80">Radioactive</dt>
          <dd>{p.radioactive ? 'Yes' : 'No'}</dd>
        </dl>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Add this item to your cart"
              aria-busy={auctionActive || adding ? 'true' : 'false'}
              disabled={auctionActive || adding}
              className={pressBtn("inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]")}
              onClick={async () => {
                if (auctionActive) return;
                try {
                  setAdding(true);
                  const r = await addToCart(pid, 1);
                  if (r?.error === 'AUTH_REQUIRED') {
                    toast.error('Please log in to add items to your cart.');
                    return;
                  }
                  if (r?.error) {
                    toast.error(r.error || 'Could not add to cart.');
                    return;
                  }
                  toast.success('Added to cart');
                } catch {
                  toast.error('Could not add to cart.');
                } finally {
                  setAdding(false);
                }
              }}
            >
              {adding ? 'Adding…' : 'Add to Cart'}
            </button>

            <Link
              to="/products"
              className={pressBtn("rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset")}
              style={{
                background: 'var(--theme-surface)',
                color: 'var(--theme-text)',
                borderColor: 'var(--theme-border)',
              }}
            >
              Back to Shop
            </Link>
          </div>

          {auctionActive && (
            <p className="text-base text-[var(--theme-error)] opacity-80">
              This item is currently at auction. Add to cart is disabled until the auction ends.
            </p>
          )}

          {p.description && (
            <div className="lg:col-span-2 rounded-xl border p-4 mt-6" style={card}>
              <h2 className="mb-2 text-lg font-semibold text-[var(--theme-text)]">Description</h2>
              <p className="whitespace-pre-wrap text-sm opacity-90">{p.description}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
