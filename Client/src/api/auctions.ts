// Client/src/api/auctions.ts
import { get, post, del } from '../lib/api';

export type AuctionDto = {
  id: number;
  title?: string | null;
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'canceled';
  startAt?: string | null;             // optional: server may include
  endAt: string | null;                 // ISO or null
  productId?: number;                   // optional: included by some reads
  vendorId?: number;                    // optional: included by some reads
  highBidCents: number | null;
  highBidUserId: number | null;
  startingBidCents: number;
  reserveCents: number | null;
  buyNowCents?: number | null;          // optional: Buy It Now (if configured)
};

/** List-card DTO used by list screens. */
export type AuctionListItem = {
  id: number;
  title?: string | null;
  productId?: number;
  vendorId?: number;
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'canceled';
  startAt?: string | null;
  endAt: string | null;
  startingBidCents: number;
  highBidCents: number | null;
  highBidUserId: number | null;
};

export type PlaceBidRes = {
  ok: true;
  data: {
    leaderUserId: number;
    highBidCents: number;
    youAreLeading: boolean;
    minNextBidCents: number;
  };
};

export type MinimumBidRes = {
  minNextBidCents: number;
};

export type CreateAuctionInput = {
  productId: number;
  title: string;
  startingBidCents: number;
  durationDays: 1 | 3 | 5 | 7;
  reserveCents?: number | null;
  buyNowCents?: number | null;
  incrementLadderJson?: { upToCents: number | null; incrementCents: number }[];
};

// NOTE: your lib/api auto-prefixes /api, so paths below must NOT start with /api
export function getAuction(auctionId: number) {
  return get<{ data: AuctionDto }>(`/auctions/${auctionId}`);
}

export function getMinimumBid(auctionId: number) {
  return get<MinimumBidRes>(`/auctions/${auctionId}/minimum`);
}

export function placeBid(opts: { auctionId: number; amountCents: number; maxProxyCents?: number }) {
  return post<PlaceBidRes, { amountCents: number; maxProxyCents?: number }>(
    `/auctions/${opts.auctionId}/bid`,
    { amountCents: opts.amountCents, maxProxyCents: opts.maxProxyCents }
  );
}

/** Create a new auction (vendor). */
export function createAuction(input: CreateAuctionInput) {
  return post<{ ok: boolean; id: number }, CreateAuctionInput>(`/auctions`, input);
}

/** Buy It Now action (if enabled for the auction). */
export function buyNow(auctionId: number) {
  return post<{ ok: boolean; code?: string }, Record<string, never>>(`/auctions/${auctionId}/buy-now`, {});
}

/** Add current user to the auction watchlist. */
export function watchAuction(auctionId: number) {
  return post<{ ok: boolean }, Record<string, never>>(`/auctions/${auctionId}/watch`, {});
}

/** Remove current user from the auction watchlist. */
export function unwatchAuction(auctionId: number) {
  return del<{ ok: boolean }>(`/auctions/${auctionId}/watch`);
}

/**
 * List auctions with optional client-side filters.
 * Returns a stable `{ ok, items }` shape to match list pages.
 */
export async function listAuctions(params?: {
  q?: string;
  vendorId?: number;
  sort?: 'ending' | 'newest';
  status?: 'draft' | 'scheduled' | 'live' | 'ended' | 'canceled';
}) {
  const search = new URLSearchParams();

  if (params && typeof params.q === 'string' && params.q.trim().length > 0) {
    search.set('q', params.q.trim());
  }
  if (params && typeof params.vendorId === 'number') {
    search.set('vendorId', String(params.vendorId));
  }
  if (params && typeof params.sort === 'string') {
    search.set('sort', params.sort);
  }
  if (params && typeof params.status === 'string') {
    search.set('status', params.status);
  }

  let url = '/auctions';
  const qs = search.toString();
  if (qs.length > 0) {
    url = `${url}?${qs}`;
  }

  const res = await get<{ items?: AuctionListItem[] } | AuctionListItem[]>(url);

  // Handle error shape from lib/api
  if ('error' in res) {
    const anyRes = res as any;
    if (anyRes?.error) {
      return { ok: false as const, items: [] as AuctionListItem[], error: anyRes.error as string };
    }
  }

  const anyRes = res as any;
  const payload = anyRes ? anyRes.data : null;

  let items: AuctionListItem[] = [];
  const isArray = Array.isArray(payload);
  if (isArray) {
    items = payload as AuctionListItem[];
  } else {
    const maybeItems = payload?.items;
    if (Array.isArray(maybeItems)) {
      items = maybeItems as AuctionListItem[];
    }
  }

  return { ok: true as const, items, error: null as string | null };
}

export async function listActiveAuctions() {
  // supports both { items: AuctionDto[] } and bare AuctionDto[] responses
  const res = await get<{ items?: AuctionDto[] } | AuctionDto[]>(`/auctions?status=live`);
  if ('error' in res && (res as any).error) {
    return res as any;
  }

  const dataAny = (res as any).data;
  const items: AuctionDto[] = Array.isArray(dataAny) ? dataAny : dataAny?.items || [];
  return { data: items, error: null as string | null };
}
