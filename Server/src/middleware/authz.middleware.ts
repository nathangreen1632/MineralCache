// Server/src/middleware/authz.middleware.ts
import type { Request, Response, NextFunction } from 'express';

/** If you want Request.user typed in TS (pulled from req.session.user) */
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: number;
      role: 'buyer' | 'vendor' | 'admin';
      dobVerified18: boolean;
      email?: string;
    } | null;
  }
}

/** Utility: copy session user onto req.user so downstream code is typed */
export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const u = (req.session as any)?.user ?? null;
  req.user = u;
  next();
}

/** Middleware style — for route defs */
export function requireAuthed(req: Request, res: Response, next: NextFunction): void {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  req.user = u;
  next();
}

export function requireAdult(req: Request, res: Response, next: NextFunction): void {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!u.dobVerified18) {
    res.status(403).json({ error: 'Age verification required' });
    return;
  }
  next();
}

/** Function style — for use *inside* controllers if you prefer:
 * if (!ensureAuthed(req, res)) return; if (!ensureAdult(req, res)) return;
 */
export function ensureAuthed(req: Request, res: Response): req is Request & { user: NonNullable<Request['user']> } {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  req.user = u;
  return true;
}

export function ensureAdult(req: Request, res: Response): boolean {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  if (!u.dobVerified18) {
    res.status(403).json({ error: 'Age verification required' });
    return false;
  }
  return true;
}
