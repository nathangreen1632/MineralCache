// Server/src/controllers/auctions.controller.ts
import type { Request, Response } from 'express';
import type { Server as IOServer } from 'socket.io';
import { emitAuctionNewBid, emitAuctionEnded } from '../sockets/emitters/auctions.emit.js';

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
 * Public reads
 * -----------------------------------------------------------------------*/
export async function listAuctions(_req: Request, res: Response): Promise<void> {
  res.json({ items: [], total: 0 });
}

export async function getAuction(_req: Request, res: Response): Promise<void> {
  res.json({ item: null });
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

  const auctionId = parsePositiveInt((req.body)?.auctionId);
  const amountCents = parsePositiveInt((req.body)?.amountCents);

  if (auctionId == null || amountCents == null) {
    res.status(400).json({ error: 'Invalid auctionId or amountCents' });
    return;
  }

  // TODO: validate against DB, apply proxy-bid logic, persist bid

  const io = getIO(req);
  if (io) {
    emitAuctionNewBid(io, auctionId, {
      amountCents,
      userId: (req as any).user.id,
    });
  }

  res.status(202).json({ ok: true });
}

/** ------------------------------------------------------------------------
 * Buy It Now (auth + 18+ required)
 * Emits an "ended" event to the room.
 * -----------------------------------------------------------------------*/
export async function buyNow(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;
  if (!ensureAdult(req, res)) return;

  const auctionId = parsePositiveInt((req.body)?.auctionId);
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
