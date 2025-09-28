import { Transaction } from 'sequelize';
import { Auction, type IncrementTier } from '../models/auction.model.js';
import { Bid } from '../models/bid.model.js';

export type Ladder = IncrementTier[];

const DEFAULT_LADDER: Ladder = [
  { upToCents: 10_00, incrementCents: 50 },      // <$10 → $0.50
  { upToCents: 50_00, incrementCents: 100 },     // <$50 → $1
  { upToCents: 200_00, incrementCents: 500 },    // <$200 → $5
  { upToCents: 1000_00, incrementCents: 1000 },  // <$1000 → $10
  { upToCents: null, incrementCents: 5000 },     // ≥last → $50
];

export function ladderIncrementFor(priceCents: number, ladder: Ladder = DEFAULT_LADDER): number {
  for (const tier of ladder) {
    if (tier.upToCents == null) return tier.incrementCents;
    if (priceCents < tier.upToCents) return tier.incrementCents;
  }
  return ladder[ladder.length - 1].incrementCents;
}

export function minimumAcceptableBid(auction: Auction): number {
  if (auction.highBidCents == null) return auction.startingBidCents;
  const inc = ladderIncrementFor(auction.highBidCents, auction.incrementLadderJson ?? DEFAULT_LADDER);
  return auction.highBidCents + inc;
}

function proxyCeiling(amount: number, proxy?: number | null): number {
  if (typeof proxy === 'number' && proxy > amount) return proxy;
  return amount;
}

/**
 * Resolve outcome between previous leader (with proxy) and challenger (with proxy).
 * Uses single-increment resolution (MVP): winner pays min(ownProxy, otherProxy + incAt(otherProxy))
 */
export function resolveProxies(prevProxy: number, challengerProxy: number, ladder: Ladder): {
  winner: 'prev' | 'challenger';
  clearingPrice: number;
} {
  if (challengerProxy <= prevProxy) {
    const inc = ladderIncrementFor(Math.min(prevProxy, challengerProxy), ladder);
    const tgt = challengerProxy + inc;
    const clearing = Math.min(prevProxy, tgt);
    return { winner: 'prev', clearingPrice: clearing };
  }
  const inc = ladderIncrementFor(Math.min(prevProxy, challengerProxy), ladder);
  const tgt = prevProxy + inc;
  const clearing = Math.min(challengerProxy, tgt);
  return { winner: 'challenger', clearingPrice: clearing };
}

/** Insert bid + update auction atomically; returns snapshot */
export async function placeBidTx(opts: {
  auctionId: number;
  userId: number;
  amountCents: number;
  maxProxyCents?: number | null;
  now: Date;
  tx: Transaction;
}) {
  const { auctionId, userId, amountCents, maxProxyCents, now, tx } = opts;

  const auction = await Auction.findOne({ where: { id: auctionId }, transaction: tx, lock: tx.LOCK.UPDATE });
  if (!auction) return { ok: false as const, error: 'Auction not found' };

  if (auction.status !== 'live') return { ok: false as const, error: 'Auction is not live' };
  if (auction.endAt && now >= new Date(auction.endAt)) return { ok: false as const, error: 'Auction has ended' };

  const ladder = auction.incrementLadderJson ?? DEFAULT_LADDER;

  const min = minimumAcceptableBid(auction);
  if (!Number.isFinite(amountCents) || amountCents < min) {
    return { ok: false as const, error: `Bid must be at least ${min}` };
  }

  const prevLeaderId = auction.highBidUserId ?? null;
  const prevHigh = auction.highBidCents ?? null;

  // Persist raw bid record
  const bid = await Bid.create(
    {
      auctionId: auction.id,
      userId,
      amountCents,
      maxProxyCents: maxProxyCents ?? null,
    },
    { transaction: tx }
  );

  // Determine effective proxies
  const challengerProxy = proxyCeiling(amountCents, maxProxyCents);
  let winner: 'prev' | 'challenger' = 'challenger';
  let clearingPrice = amountCents;

  if (prevHigh != null && prevLeaderId != null) {
    // Load latest bid from previous leader to get their proxy ceiling
    const prevLeaderBid = await Bid.findOne({
      where: { auctionId: auction.id, userId: prevLeaderId },
      order: [['createdAt', 'DESC']],
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    const prevProxy = proxyCeiling(prevHigh, prevLeaderBid?.maxProxyCents ?? null);
    const r = resolveProxies(prevProxy, challengerProxy, ladder);
    winner = r.winner;
    clearingPrice = r.clearingPrice;
  }

  if (winner === 'prev' && prevLeaderId != null && prevHigh != null) {
    // Previous leader remains; just lift the current price if needed
    if (clearingPrice !== prevHigh) {
      auction.highBidCents = clearingPrice;
      await auction.save({ transaction: tx });
    }
    return {
      ok: true as const,
      persistedBidId: bid.id,
      leaderUserId: prevLeaderId,
      highBidCents: auction.highBidCents,
      youAreLeading: userId === prevLeaderId,
      minNextBidCents: minimumAcceptableBid(auction),
      prevLeaderChanged: false,
    };
  }

  // Challenger becomes the leader
  auction.highBidUserId = userId;
  auction.highBidCents = clearingPrice;
  await auction.save({ transaction: tx });

  return {
    ok: true as const,
    persistedBidId: bid.id,
    leaderUserId: userId,
    highBidCents: auction.highBidCents,
    youAreLeading: true,
    minNextBidCents: minimumAcceptableBid(auction),
    prevLeaderChanged: prevLeaderId != null && prevLeaderId !== userId,
    prevLeaderId,
  };
}
