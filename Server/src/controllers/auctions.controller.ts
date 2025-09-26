// Server/src/controllers/auctions.controller.ts
import type { Request, Response } from 'express';
import type { Server as IOServer } from 'socket.io';
import { emitAuctionNewBid, emitAuctionEnded, emitAuctionLeadingBid, emitAuctionOutbid } from '../sockets/emitters/auctions.emit.js';

/** ------------------------------------------------------------------------
 * Helpers (auth + age gate)
 * -----------------------------------------------------------------------*/
function ensureAuthed(req: Request, res: Response): req is Request & {
  user: { id: number; role: 'buyer' | 'vendor' | 'admin'; dobVerified18: boolean };
} {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  (req as any).user = u;
  return true;
}

function ensureAdult(req: Request, res: Response): boolean {
  const u = (req.session as any)?.user;
  if (!u?.dobVerified18) {
    res.status(403).json({ error: 'Age verification required' });
    return false;
  }
  return true;
}

function getIO(req: Request): IOServer | null {
  const io = req.app.get('io') as IOServer | undefined;
  return io ?? null;
}

function parsePositiveInt(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}

/** ------------------------------------------------------------------------
 * In-memory scaffold state (reset on process restart) — no DB yet
 * -----------------------------------------------------------------------*/
type AuctionState = {
  leadingBidCents: number;
  leadingUserId: number | null;
  history: Array<{ userId: number; amountCents: number; ts: number }>;
};

const AUCTIONS = new Map<number, AuctionState>();

function getOrCreateAuction(id: number): AuctionState {
  let a = AUCTIONS.get(id);
  if (!a) {
    a = { leadingBidCents: 0, leadingUserId: null, history: [] };
    AUCTIONS.set(id, a);
  }
  return a;
}

/** ------------------------------------------------------------------------
 * Public reads
 * -----------------------------------------------------------------------*/
export async function listAuctions(_req: Request, res: Response): Promise<void> {
  res.json({ items: [], total: 0 });
}

export async function getAuction(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt((req.params as any)?.id);
  if (id == null) {
    res.status(400).json({ error: 'Invalid auction id' });
    return;
  }
  const a = getOrCreateAuction(id);
  res.json({
    id,
    leadingBidCents: a.leadingBidCents,
    leadingUserId: a.leadingUserId,
  });
}

/** ------------------------------------------------------------------------
 * Vendor create (auth required; age gate not required for creating)
 * -----------------------------------------------------------------------*/
export async function createAuction(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;
  if (req.user?.role !== 'vendor' && req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // TODO: validate payload with zod; persist; schedule open/close jobs
  res.status(201).json({ id: null });
}

/** ------------------------------------------------------------------------
 * Bidding (auth + 18+ required)
 * Emits a socket event so watching clients update live.
 * -----------------------------------------------------------------------*/
export async function placeBid(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;
  if (!ensureAdult(req, res)) return;

  // With routes: POST /api/auctions/:id/bid (amountCents in body)
  const auctionId = parsePositiveInt((req.params as any)?.id);
  const amountCents = parsePositiveInt((req.body)?.amountCents);

  if (auctionId == null || amountCents == null) {
    res.status(400).json({ error: 'Invalid auction id or amountCents' });
    return;
  }

  // TODO: validate against DB, apply proxy-bid logic, persist bid

  // Scaffolding: simple min increment ladder ($1)
  const a = getOrCreateAuction(auctionId);
  const minIncrement = 100;
  const minAcceptable = a.leadingBidCents > 0 ? a.leadingBidCents + minIncrement : minIncrement;

  if (amountCents < minAcceptable) {
    res.status(400).json({
      error: 'Bid too low',
      code: 'BID_TOO_LOW',
      minAcceptableCents: minAcceptable,
      leadingBidCents: a.leadingBidCents,
    });
    return;
  }

  const previousLeader = a.leadingUserId;
  const previousAmount = a.leadingBidCents;

  // Update in-memory state (scaffold)
  a.leadingBidCents = amountCents;
  a.leadingUserId = Number((req as any).user.id);
  a.history.push({ userId: Number((req as any).user.id), amountCents, ts: Date.now() });

  const io = getIO(req);
  if (io) {
    // Back-compat "new-bid" event
    emitAuctionNewBid(io, auctionId, {
      amountCents,
      userId: (req as any).user.id,
    });

    // Outbid + current leader hints for richer UIs
    if (previousLeader && previousAmount > 0 && previousLeader !== (req as any).user.id) {
      emitAuctionOutbid(io, auctionId, {
        previousUserId: previousLeader,
        amountCents,
      });
    }
    emitAuctionLeadingBid(io, auctionId, {
      amountCents,
      userId: (req as any).user.id,
    });
  }

  res.status(201).json({
    ok: true,
    auctionId,
    leadingBidCents: a.leadingBidCents,
    leadingUserId: a.leadingUserId,
  });
}

/** ------------------------------------------------------------------------
 * Buy It Now (auth + 18+ required)
 * Emits an "ended" event to the room.
 * -----------------------------------------------------------------------*/
export async function buyNow(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;
  if (!ensureAdult(req, res)) return;

  // With routes: POST /api/auctions/:id/buy-now
  const auctionId = parsePositiveInt((req.params as any)?.id);
  if (auctionId == null) {
    res.status(400).json({ error: 'Invalid auctionId' });
    return;
  }

  // TODO: validate; lock auction; create reserved checkout; persist

  const io = getIO(req);
  if (io) {
    emitAuctionEnded(io, auctionId, { reason: 'buy-now' });
  }

  res.status(202).json({ ok: true });
}
