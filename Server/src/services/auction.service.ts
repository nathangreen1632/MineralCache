// Server/src/services/auction.service.ts
import {Transaction, Op} from 'sequelize';
import {Auction, type IncrementTier} from '../models/auction.model.js';
import {Bid} from '../models/bid.model.js';
import {stopAuctionTicker} from '../sockets/tickers/auctionTicker.js';
import {logInfo, logWarn} from './log.service.js';
import {Cart} from '../models/cart.model.js';
import {AuctionLock} from '../models/auctionLock.model.js';

export type Ladder = IncrementTier[];

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
  return ladder[ladder.length - 1]?.incrementCents ?? 100;
}

export function minimumAcceptableBid(a: Auction): number {
  const ladder = effectiveLadder(a);
  const base = a.highBidCents ?? a.startPriceCents ?? 0;
  const inc = ladderIncrementFor(base, ladder);
  return base + inc;
}

async function upsertCartLine(tx: Transaction, userId: number, productId: number) {
  const existing = await Cart.findOne({ where: { userId }, transaction: tx, lock: (tx as any).LOCK?.UPDATE });
  const line = { productId: Number(productId), quantity: 1 };
  if (!existing) {
    await Cart.create({ userId: Number(userId), itemsJson: [line] } as any, { transaction: tx });
    return;
  }
  const raw: Array<{ productId: unknown; quantity: unknown }> = (existing as any).itemsJson ?? [];
  const items = raw
    .map((x) => ({
      productId: Number((x as any).productId),
      quantity: Math.max(1, Math.trunc(Number((x as any).quantity ?? 1))),
    }))
    .filter((x) => Number.isFinite(x.productId) && x.productId > 0);
  const idx = items.findIndex((x) => x.productId === Number(productId));
  if (idx >= 0) items[idx].quantity = 1; else items.push(line);
  (existing as any).itemsJson = items;
  await existing.save({ transaction: tx });
}

async function purgeProductFromOtherCarts(tx: Transaction, productId: number, winnerUserId: number) {
  const carts = await Cart.findAll({
    where: { userId: { [Op.ne]: Number(winnerUserId) } },
    transaction: tx,
    lock: (tx as any).LOCK?.UPDATE,
  });
  for (const c of carts) {
    const raw: unknown = (c as any).itemsJson ?? [];
    const items = Array.isArray(raw) ? raw : [];
    const next = items.filter((it: any) => Number(it?.productId) !== Number(productId));
    if (next.length !== items.length) {
      (c as any).itemsJson = next;
      await c.save({ transaction: tx });
    }
  }
}

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
  const prevHigh = auction.highBidCents ?? auction.startPriceCents ?? 0;

  const bid = await Bid.create(
    {
      auctionId: auction.id,
      userId,
      amountCents: requested,
      maxProxyCents: proxy,
    },
    { transaction: tx }
  );

  if (prevLeaderId == null) {
    auction.highBidCents = Math.max(requested, minNext);
    auction.highBidUserId = userId;

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

  const outcome = resolveProxies(prevHigh, proxy, ladder);

  auction.highBidCents = outcome.clearingPrice;
  auction.highBidUserId = outcome.winner === 'prev' ? prevLeaderId : userId;

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

type EndActor =
  | { kind: 'vendor'; vendorId: number }
  | { kind: 'admin' };

export type EndAuctionReason =
  | 'manual_close'
  | 'vendor_canceled'
  | 'admin_canceled'
  | 'natural_end';

export type EndAuctionResult = {
  auction: Auction;
  alreadyFinal: boolean;
  reason: EndAuctionReason;
};

async function getAuctionForUpdate(auctionId: number, tx: Transaction): Promise<Auction | null> {
  return Auction.findByPk(auctionId, { transaction: tx, lock: true as any });
}

export async function endAuctionTx(
  tx: Transaction,
  auctionId: number,
  actor: EndActor,
  reason: EndAuctionReason = 'manual_close',
): Promise<EndAuctionResult> {
  logInfo('auction.end.start', { auctionId, reason, actor: actor.kind });

  const a = await getAuctionForUpdate(auctionId, tx);
  if (!a) {
    logWarn('auction.end.not_found', { auctionId });
    throw Object.assign(new Error('Auction not found'), {code: 'NOT_FOUND' as const});
  }

  if (actor.kind === 'vendor' && a.vendorId !== actor.vendorId) {
    logWarn('auction.end.forbidden_vendor_mismatch', { auctionId, vendorId: actor.vendorId, ownerVendorId: a.vendorId });
    throw Object.assign(new Error('Forbidden'), {code: 'FORBIDDEN' as const});
  }

  if (a.status === 'ended' || a.status === 'canceled') {
    logInfo('auction.end.already_final', { auctionId, status: a.status });
    return { auction: a, alreadyFinal: true, reason };
  }

  a.status = 'ended';
  a.endAt = new Date();
  await a.save({ transaction: tx });

  const reserve = a.reservePriceCents ?? null;
  const sold =
    a.highBidUserId != null &&
    a.productId != null &&
    (reserve == null || (a.highBidCents ?? 0) >= reserve);

  if (sold) {
    const winnerUserId = Number(a.highBidUserId);
    const productId = Number(a.productId);
    const priceCents = Number(a.highBidCents ?? 0);

    await upsertCartLine(tx, winnerUserId, productId);
    await purgeProductFromOtherCarts(tx, productId, winnerUserId);

    const holdMs = 5 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + holdMs);

    const existingActive = await AuctionLock.findOne({
      where: { productId, status: 'active' },
      transaction: tx,
      lock: (tx as any).LOCK?.UPDATE,
    });

    if (!existingActive) {
      await AuctionLock.create(
        { productId, userId: winnerUserId, auctionId, priceCents, expiresAt, status: 'active' } as any,
        { transaction: tx }
      );
    }
  }

  try { stopAuctionTicker(a.id); } catch (e) { logWarn('auction.end.stop_ticker_failed', { auctionId, err: String(e) }); }

  logInfo('auction.end.success', { auctionId, status: a.status, endAt: a.endAt });
  return { auction: a, alreadyFinal: false, reason };
}


export async function cancelAuctionTx(
  tx: Transaction,
  auctionId: number,
  actor: EndActor,
  reason: EndAuctionReason = actor.kind === 'admin' ? 'admin_canceled' : 'vendor_canceled',
): Promise<EndAuctionResult> {
  logInfo('auction.cancel.start', { auctionId, reason, actor: actor.kind });

  const a = await getAuctionForUpdate(auctionId, tx);
  if (!a) {
    logWarn('auction.cancel.not_found', { auctionId });
    throw Object.assign(new Error('Auction not found'), {code: 'NOT_FOUND' as const});
  }

  if (actor.kind === 'vendor' && a.vendorId !== actor.vendorId) {
    logWarn('auction.cancel.forbidden_vendor_mismatch', { auctionId, vendorId: actor.vendorId, ownerVendorId: a.vendorId });
    throw Object.assign(new Error('Forbidden'), {code: 'FORBIDDEN' as const});
  }

  if (a.status === 'ended' || a.status === 'canceled') {
    logInfo('auction.cancel.already_final', { auctionId, status: a.status });
    return { auction: a, alreadyFinal: true, reason };
  }

  if (a.status !== 'live' && a.status !== 'scheduled' && a.status !== 'draft') {
    logWarn('auction.cancel.invalid_state', { auctionId, status: a.status });
    throw Object.assign(new Error('Invalid state transition'), {code: 'INVALID_STATE' as const});
  }

  a.status = 'canceled';
  a.endAt ??= new Date();
  await a.save({ transaction: tx });

  try { stopAuctionTicker(a.id); } catch (e) { logWarn('auction.cancel.stop_ticker_failed', { auctionId, err: String(e) }); }

  logInfo('auction.cancel.success', { auctionId, status: a.status, endAt: a.endAt });
  return { auction: a, alreadyFinal: false, reason };
}
