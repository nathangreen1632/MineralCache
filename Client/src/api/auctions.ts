// Client/src/api/auctions.ts
import { get, post, del } from '../lib/api';

export type AuctionDto = {
  id: number;
  title?: string | null;
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'canceled';
  startAt?: string | null;             // optional: server may include
  endAt: string | null;                // ISO or null
  productId?: number;                  // optional: included by some reads
  vendorId?: number;                   // optional: included by some reads
  highBidCents: number | null;
  highBidUserId: number | null;
  startingBidCents: number;
  reserveCents: number | null;
  buyNowCents?: number | null;         // optional: Buy It Now (if configured)

  // ✅ optional, for UI convenience
  vendorSlug?: string | null;
};

/** Export a handy union for consumers (e.g., components). */
export type AuctionStatus = AuctionDto['status'];

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

  // NEW (optional, server-provided for list views)
  productTitle?: string | null;
  imageUrl?: string | null;

  // ✅ optional; if server includes or we can infer
  vendorSlug?: string | null;
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

/** ✅ NEW: partial update payload for editing auctions */
export type UpdateAuctionInput = {
  title?: string;
  startingBidCents?: number;
  durationDays?: 1 | 3 | 5 | 7;
  reserveCents?: number | null;
  buyNowCents?: number | null;
  incrementLadderJson?: { upToCents: number | null; incrementCents: number }[];
};

// ——— helpers ———
function pickVendorSlug(x: any): string | null {
  const v =
    x?.vendorSlug ??
    x?.vendor_slug ??
    x?.vendor?.slug ??
    x?.product?.vendorSlug ??
    x?.product?.vendor_slug ??
    null;
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

// NOTE: your lib/api auto-prefixes /api, so paths below must NOT start with /api
export async function getAuction(auctionId: number) {
  // Allow vendorSlug in the typed payload (optional)
  const res = await get<{ data: AuctionDto & { [k: string]: any } }>(`/auctions/${auctionId}`);

  // Pass through errors untouched
  if ((res as any)?.error) return res as any;

  // Inject a flat vendorSlug onto data.data if we can infer one
  const body: any = (res as any)?.data;
  if (body?.data) {
    const raw = body.data;
    const slug = pickVendorSlug(raw);
    if (slug && raw.vendorSlug !== slug) {
      return {
        ...res,
        data: { ...body, data: { ...raw, vendorSlug: slug } },
      };
    }
  }
  return res as any;
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

/** ✅ NEW: Update an existing auction (vendor). */
export function updateAuction(auctionId: number, input: UpdateAuctionInput) {
  return post<{ ok: boolean; code?: string }, UpdateAuctionInput>(`/auctions/${auctionId}/edit`, input);
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
  /** ✅ NEW (optional) */
  species?: string;
  /** ✅ NEW (optional) */
  synthetic?: boolean;
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
  // ✅ NEW: optional filters
  if (params && typeof params.species === 'string' && params.species.trim().length > 0) {
    search.set('species', params.species.trim());
  }
  if (params && typeof params.synthetic === 'boolean') {
    search.set('synthetic', params.synthetic ? '1' : '0');
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
    items = (payload).map((it) => ({
      ...it,
      vendorSlug: pickVendorSlug(it),
    }));
  } else {
    const maybeItems = payload?.items;
    if (Array.isArray(maybeItems)) {
      items = (maybeItems).map((it) => ({
        ...it,
        vendorSlug: pickVendorSlug(it),
      }));
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
  const itemsRaw: any[] = Array.isArray(dataAny) ? dataAny : dataAny?.items || [];
  // Normalize vendorSlug on the way out (optional)
  const items = itemsRaw.map((a) => ({ ...a, vendorSlug: pickVendorSlug(a) })) as AuctionDto[];
  return { data: items, error: null as string | null };
}

/** Close an auction now (vendor owner or admin). */
export function closeAuction(auctionId: number) {
  return post<
    { ok: boolean; code?: string; auction: { id: number; status: AuctionStatus; endAt: string | null; highBidCents: number | null } },
    Record<string, never>
  >(`/auctions/${auctionId}/close`, {});
}

/** Cancel an auction (vendor owner or admin). */
export function cancelAuction(auctionId: number) {
  return post<
    { ok: boolean; code?: string; auction: { id: number; status: AuctionStatus; endAt: string | null; highBidCents: number | null } },
    Record<string, never>
  >(`/auctions/${auctionId}/cancel`, {});
}
