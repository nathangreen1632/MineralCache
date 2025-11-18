// Client/src/pages/auctions/AuctionWatchPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import AuctionCard from '../../components/auctions/AuctionCard';
import { listWatchedAuctions, type AuctionListItem } from '../../api/auctions';
import { useAuthStore } from '../../stores/useAuthStore';

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

export default function AuctionWatchPage(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const isAuthed = Boolean(user);

  const [items, setItems] = useState<AuctionListItem[] | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'ending' | 'newest'>('ending');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthed) return;

    let isMounted = true;
    setLoading(true);
    listWatchedAuctions()
      .then((res) => {
        if (!isMounted) return;
        if (res.ok) setItems(res.items);
        else setErr(res.error || 'Failed to load watchlist');
      })
      .catch(() => {
        if (isMounted) setErr('Failed to load watchlist');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthed]);

  const filtered = useMemo(() => {
    const base = items ?? [];
    const trimmed = q.trim().toLowerCase();

    let out = base;

    if (trimmed.length > 0) {
      out = out.filter((x) => titleSafe(x).toLowerCase().includes(trimmed));
    }

    const sorted = [...out];
    if (sort === 'ending') sorted.sort(byEndingSoon);
    else sorted.sort(byNewest);
    return sorted;
  }, [items, q, sort]);

  if (!isAuthed) {
    return (
      <main className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
        <div className="mx-auto max-w-4xl px-6 py-14 grid gap-6">
          <h1 className="text-4xl font-bold">Auctions Watchlist</h1>
          <p className="text-lg">
            Sign in to view the auctions you are watching.
          </p>
        </div>
      </main>
    );
  }

  const empty = !loading && !err && (filtered ?? []).length === 0;

  return (
    <main className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-8xl px-6 py-14 grid gap-10">
        <div>
          <h1 className="text-4xl font-bold">Auctions Watchlist</h1>
          <p className="mt-2 text-base opacity-80">
            Auctions you have added to your watchlist.
          </p>
        </div>

        <header aria-label="Filters" className="grid gap-3 max-w-3xl mx-auto">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
            <input
              aria-label="Search watched auctions"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title..."
              className="w-full sm:w-[28rem] rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
            />

            <div className="flex items-center gap-2">
              <label htmlFor="watch-sort" className="text-sm">
                Sort
              </label>
              <div className="relative">
                <select
                  id="watch-sort"
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
            className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-error)] p-4"
          >
            {err}
          </div>
        )}

        {empty && (
          <div
            role="text"
            aria-live="polite"
            className="rounded-xl border border-[var(--theme-error)] bg-[var(--theme-card)] p-4 text-lg"
          >
            You are not watching any auctions yet.
          </div>
        )}

        {!empty && (
          <section
            aria-label="Watched auctions"
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
        )}
      </div>
    </main>
  );
}
