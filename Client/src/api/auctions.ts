// Client/src/api/auctions.ts
import { get, post } from '../lib/api';

export type AuctionDto = {
  id: number;
  title?: string | null;
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'canceled';
  endAt: string | null;                 // ISO or null
  highBidCents: number | null;
  highBidUserId: number | null;
  startingBidCents: number;
  reserveCents: number | null;
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

export async function listActiveAuctions() {
  // supports both { items: AuctionDto[] } and bare AuctionDto[] responses
  const res = await get<{ items?: AuctionDto[] } | AuctionDto[]>(`/auctions?status=live`);
  if ('error' in res && res.error) return res as any;

  const dataAny = (res as any).data;
  const items: AuctionDto[] = Array.isArray(dataAny) ? dataAny : dataAny?.items || [];
  return { data: items, error: null as string | null };
}
