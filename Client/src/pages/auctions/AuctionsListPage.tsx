import React, { useEffect, useMemo, useState } from 'react';
import AuctionCard from '../../components/auctions/AuctionCard';
import { listAuctions, type AuctionListItem } from '../../api/auctions';

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
  const [sort, setSort] = useState<'ending' | 'newest'>('ending');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    listAuctions()
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
  }, []);

  const filtered = useMemo(() => {
    const base = items ?? [];
    const trimmed = q.trim().toLowerCase();

    let searched = base;
    if (trimmed.length > 0) {
      searched = base.filter((x) => titleSafe(x).toLowerCase().includes(trimmed));
    }

    const out = [...searched];
    if (sort === 'ending') out.sort(byEndingSoon);
    else out.sort(byNewest);
    return out;
  }, [items, q, sort]);

  return (
    <main className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-12xl px-6 py-14 grid gap-10">
        {/* Standalone, left-aligned page title */}
        <div>
          <h1 className="text-2xl font-bold">Auctions</h1>
        </div>

        {/* Header with centered controls */}
        <header aria-label="Filters" className="grid gap-3 max-w-3xl mx-auto">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
            <input
              aria-label="Search auctions"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title..."
              className="w-full sm:w-[28rem] rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
            />
            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-sm">Sort</label>
              <select
                id="sort"
                aria-label="Sort auctions"
                value={sort}
                onChange={(e) => setSort(e.target.value as 'ending' | 'newest')}
                className="rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-3 py-2"
              >
                <option value="ending">Ending soon</option>
                <option value="newest">Newest</option>
              </select>
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

        {/* 2 @ md, 3 @ lg, 4 @ xl+ */}
        <section
          aria-label="Auction results"
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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
            />
          ))}
        </section>
      </div>
    </main>
  );
}
