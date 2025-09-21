// Server/src/controllers/auctions.controller.ts
import type { Request, Response } from 'express';

/** ------------------------------------------------------------------------
 * Helpers (auth + age gate)
 * -----------------------------------------------------------------------*/
function ensureAuthed(req: Request, res: Response): req is Request & {
  user: { id: number; role: 'buyer' | 'vendor' | 'admin'; dobVerified18: boolean }
} {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  // mirror onto req.user so downstream code can rely on it
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
  // Optional: restrict to vendors/admins only
  if (req.user?.role !== 'vendor' && req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' }); return;
  }

  // TODO: validate payload with zod; persist; schedule open/close jobs
  res.status(201).json({ id: null });
}

/** ------------------------------------------------------------------------
 * Bidding (auth + 18+ required)
 * -----------------------------------------------------------------------*/
export async function placeBid(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;
  if (!ensureAdult(req, res)) return;

  // TODO: validate bid amount with zod; apply proxy bid logic; emit socket update
  res.json({ ok: true });
}

/** ------------------------------------------------------------------------
 * Buy It Now (auth + 18+ required)
 * -----------------------------------------------------------------------*/
export async function buyNow(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;
  if (!ensureAdult(req, res)) return;

  // TODO: validate; lock auction; create reserved checkout; emit socket end
  res.json({ ok: true });
}
