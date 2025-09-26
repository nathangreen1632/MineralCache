// Client/src/api/auctions.ts
import { get, post } from '../lib/api';

export type AuctionDto = {
  id: number;
  title?: string | null;
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'canceled';
  endAt: string | null;
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

export function getAuction(auctionId: number) {
  // NOTE: your lib/api auto-prefixes /api, so path should NOT start with /api
  return get<{ data: AuctionDto }>(`/auctions/${auctionId}`);
}

export function placeBid(opts: { auctionId: number; amountCents: number; maxProxyCents?: number }) {
  return post<PlaceBidRes, { amountCents: number; maxProxyCents?: number }>(
    `/auctions/${opts.auctionId}/bid`,
    { amountCents: opts.amountCents, maxProxyCents: opts.maxProxyCents }
  );
}
