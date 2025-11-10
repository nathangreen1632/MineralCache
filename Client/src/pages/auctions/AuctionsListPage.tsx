import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import AuctionCard from '../../components/auctions/AuctionCard';
import { listAuctions, type AuctionListItem } from '../../api/auctions';
import AuctionFilters, { type Vendor as FilterVendor, type Filters as FilterState } from '../../components/auctions/AuctionFilters';

function byEndingSoon(a: AuctionListItem, b: AuctionListItem) {
  const ea = a.endAt ? new Date(a.endAt).getTime() : Number.MAX_SAFE_INTEGER;
  const eb = b.endAt ? new Date(b.endAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (ea < eb) return -1;
  if (ea > eb) return 1;
  return a.id - b.id;
}
function byNewest(a: AuctionListItem, b: AuctionListItem) {
  const sa = a.startAt ? new Date(a.startAt).getTime() : 0;
  const sb = b.startAt ? new Date(b.startAt).getTime() : 0;
  if (sa > sb) return -1;
  if (sa < sb) return 1;
  return b.id - a.id;
}
function titleSafe(x: { title?: string | null }): string {
  if (typeof x.title === 'string') return x.title;
  return '';
}

export default function AuctionsListPage(): React.ReactElement {
  const [items, setItems] = useState<AuctionListItem[] | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'ending' | 'newest'>('newest');
  const [err, setErr] = useState<string | null>(null);

  const [params, setParams] = useSearchParams();
  const initialVendorId = (() => {
    const v = params.get('vendorId');
    return v ? Number(v) : null;
  })();
  const [filters, setFilters] = useState<FilterState>({ vendorId: initialVendorId });

  const vendorOptions: FilterVendor[] = useMemo(() => {
    const base = items ?? [];
    const seen = new Map<number, string>();
    for (const it of base) {
      const id = typeof it.vendorId === 'number' ? it.vendorId : undefined;
      if (id == null) continue;
      const label =
        (typeof (it as any).vendorName === 'string' && (it as any).vendorName) ||
        (typeof it.vendorSlug === 'string' && it.vendorSlug) ||
        `Vendor #${id}`;
      if (!seen.has(id)) seen.set(id, label);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  useEffect(() => {
    const v = filters.vendorId;
    const next = new URLSearchParams(params);
    if (v == null) {
      if (next.has('vendorId')) {
        next.delete('vendorId');
        setParams(next, { replace: true });
      }
    } else if (next.get('vendorId') !== String(v)) {
      next.set('vendorId', String(v));
      setParams(next, {replace: true});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.vendorId]);

  useEffect(() => {
    let isMounted = true;
    listAuctions({
      q,
      sort,
      vendorId: filters.vendorId ?? undefined,
    })
      .then((json) => {
        if (!isMounted) return;
        if (json.ok) setItems(json.items);
        else setErr('Failed to load auctions');
      })
      .catch(() => {
        if (isMounted) setErr('Failed to load auctions');
      });
    return () => {
      isMounted = false;
    };
  }, [q, sort, filters.vendorId]);

  const filtered = useMemo(() => {
    const base = items ?? [];
    const trimmed = q.trim().toLowerCase();

    let out = base;

    if (filters.vendorId != null) {
      out = out.filter((x) => x.vendorId === filters.vendorId);
    }

    if (trimmed.length > 0) {
      out = out.filter((x) => titleSafe(x).toLowerCase().includes(trimmed));
    }

    const sorted = [...out];
    if (sort === 'ending') sorted.sort(byEndingSoon);
    else sorted.sort(byNewest);
    return sorted;
  }, [items, q, sort, filters.vendorId]);


  return (
    <main className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-8xl px-6 py-14 grid gap-10">
        <div>
          <h1 className="text-4xl font-bold">Auctions</h1>
        </div>

        <header aria-label="Filters" className="grid gap-3 max-w-3xl mx-auto">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
            <AuctionFilters
              value={filters}
              onChange={setFilters}
              vendors={vendorOptions}
              inline
            />

            <input
              aria-label="Search auctions"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title..."
              className="w-full sm:w-[28rem] rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
            />

            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-sm">Sort</label>
              <div className="relative">
                <select
                  id="sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as 'ending' | 'newest')}
                  className="appearance-none rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-3 py-2 pr-9 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
                >
                  <option value="ending">Ending soon</option>
                  <option value="newest">Newest</option>
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--theme-text)] opacity-70"
                />
              </div>
            </div>
          </div>
        </header>

        {err && (
          <div
            role="text"
            aria-live="polite"
            className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4"
          >
            {err}
          </div>
        )}

        <section
          aria-label="Auction results"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6"
        >
          {(filtered ?? []).map((a) => (
            <AuctionCard
              key={a.id}
              id={a.id}
              title={a.title}
              productTitle={a.productTitle}
              imageUrl={a.imageUrl}
              highBidCents={a.highBidCents}
              startingBidCents={a.startingBidCents}
              endAt={a.endAt}
              status={a.status}
              vendorSlug={a.vendorSlug}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
