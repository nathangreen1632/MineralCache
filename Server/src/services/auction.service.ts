// Server/src/services/auction.service.ts
import { Transaction } from 'sequelize';
import { Auction, type IncrementTier } from '../models/auction.model.js';
import { Bid } from '../models/bid.model.js';

export type Ladder = IncrementTier[];

// Week 6 plan ladder (cents): 10–50=$5; 51–500=$10; 501–1000=$25; 1001–5000=$50; 5001–10000=$100; 10001–25000=$250; 25001+=$500
const DEFAULT_LADDER: Ladder = [
  { upToCents: 50_00, incrementCents: 5_00 },
  { upToCents: 500_00, incrementCents: 10_00 },
  { upToCents: 1000_00, incrementCents: 25_00 },
  { upToCents: 5000_00, incrementCents: 50_00 },
  { upToCents: 10000_00, incrementCents: 100_00 },
  { upToCents: 25000_00, incrementCents: 250_00 },
  { upToCents: null, incrementCents: 500_00 },
];

const ANTI_SNIPING_MS =
  Number.parseInt(process.env.AUCTION_ANTI_SNIPING_MS ?? '', 10) || 3 * 60 * 1000;

function effectiveLadder(a: Auction): Ladder {
  if (Array.isArray(a.incrementLadderJson) && a.incrementLadderJson.length > 0) {
    return a.incrementLadderJson;
  }
  return DEFAULT_LADDER;
}

export function ladderIncrementFor(priceCents: number, ladder: Ladder): number {
  for (const tier of ladder) {
    if (tier.upToCents == null || priceCents <= tier.upToCents) return tier.incrementCents;
  }
  return ladder[ladder.length - 1]?.incrementCents ?? 100; // last resort
}

export function minimumAcceptableBid(a: Auction): number {
  const ladder = effectiveLadder(a);
  // NOTE: use startPriceCents (DB column) instead of startingBidCents
  const base = a.highBidCents ?? a.startPriceCents ?? 0;
  const inc = ladderIncrementFor(base, ladder);
  return base + inc;
}

/**
 * Resolve outcome between previous leader (with proxy) and challenger (with proxy).
 * Winner pays min(ownProxy, otherProxy + incAt(otherProxy)).
 */
export function resolveProxies(
  prevProxy: number,
  challengerProxy: number,
  ladder: Ladder
): { winner: 'prev' | 'challenger'; clearingPrice: number } {
  if (challengerProxy <= prevProxy) {
    const inc = ladderIncrementFor(challengerProxy, ladder);
    const target = challengerProxy + inc;
    const clearing = Math.min(prevProxy, target);
    return { winner: 'prev', clearingPrice: clearing };
  }
  const inc = ladderIncrementFor(prevProxy, ladder);
  const clearing = Math.min(challengerProxy, prevProxy + inc);
  return { winner: 'challenger', clearingPrice: clearing };
}

/**
 * Place a bid inside a DB transaction:
 * - validates ladder/min step
 * - proxy vs proxy resolution
 * - anti-sniping: extends endAt if inside window
 */
export async function placeBidTx(
  tx: Transaction,
  auction: Auction,
  userId: number,
  amountCents: number,
  maxProxyCents: number | null
): Promise<
  | {
  ok: true;
  persistedBidId: number;
  leaderUserId: number;
  highBidCents: number;
  youAreLeading: boolean;
  minNextBidCents: number;
  prevLeaderChanged: boolean;
  prevLeaderId: number | null;
  timeExtendedMs?: number;
}
  | { ok: false; error: string; minNextBidCents?: number }
> {
  if (!auction || auction.status !== 'live') {
    return { ok: false, error: 'Auction is not live' };
  }

  const ladder = effectiveLadder(auction);
  const minNext = minimumAcceptableBid(auction);
  const requested = Math.max(0, Math.trunc(amountCents));
  const proxy =
    typeof maxProxyCents === 'number' ? Math.max(requested, Math.trunc(maxProxyCents)) : requested;

  if (requested < minNext) {
    return { ok: false, error: 'Bid too low', minNextBidCents: minNext };
  }

  const prevLeaderId = auction.highBidUserId ?? null;
  // NOTE: use startPriceCents (DB column) instead of startingBidCents
  const prevHigh = auction.highBidCents ?? auction.startPriceCents ?? 0;

  // Persist challenger’s intent (requested + proxy) for audit
  const bid = await Bid.create(
    {
      auctionId: auction.id,
      userId,
      amountCents: requested,
      maxProxyCents: proxy,
    },
    { transaction: tx }
  );

  // If no previous leader → challenger becomes leader at requested (or minNext if requested overshoots weirdly)
  if (prevLeaderId == null) {
    auction.highBidCents = Math.max(requested, minNext);
    auction.highBidUserId = userId;

    // Anti-sniping extension
    let extendedMs = 0;
    if (auction.endAt && auction.endAt.getTime() - Date.now() <= ANTI_SNIPING_MS) {
      auction.endAt = new Date(Date.now() + ANTI_SNIPING_MS);
      extendedMs = ANTI_SNIPING_MS;
    }

    await auction.save({ transaction: tx });

    return {
      ok: true,
      persistedBidId: bid.id,
      leaderUserId: userId,
      highBidCents: auction.highBidCents,
      youAreLeading: true,
      minNextBidCents: minimumAcceptableBid(auction),
      prevLeaderChanged: false,
      prevLeaderId: null,
      timeExtendedMs: extendedMs || undefined,
    };
  }

  // Resolve proxy vs proxy
  // If you later store prev leader’s max proxy, swap this to that value.
  const outcome = resolveProxies(prevHigh, proxy, ladder);

  auction.highBidCents = outcome.clearingPrice;
  auction.highBidUserId = outcome.winner === 'prev' ? prevLeaderId : userId;

  // Anti-sniping extension
  let extendedMs = 0;
  if (auction.endAt && auction.endAt.getTime() - Date.now() <= ANTI_SNIPING_MS) {
    auction.endAt = new Date(Date.now() + ANTI_SNIPING_MS);
    extendedMs = ANTI_SNIPING_MS;
  }

  await auction.save({ transaction: tx });

  return {
    ok: true,
    persistedBidId: bid.id,
    leaderUserId: auction.highBidUserId,
    highBidCents: auction.highBidCents,
    youAreLeading: auction.highBidUserId === userId,
    minNextBidCents: minimumAcceptableBid(auction),
    prevLeaderChanged: auction.highBidUserId !== prevLeaderId,
    prevLeaderId,
    timeExtendedMs: extendedMs || undefined,
  };
}
