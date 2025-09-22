// Server/src/middleware/ageGate.middleware.ts
import type { NextFunction, Request, Response } from 'express';

/**
 * Enforces:
 * - 401 if not logged in
 * - 403 if logged in but not 18+ verified
 * - next() if ok
 *
 * Assumes `attachUser` already ran and placed the session user on req.user.
 */
export function require18Plus(req: Request, res: Response, next: NextFunction) {
  const u = (req as any).user ?? (req.session as any)?.user ?? null;

  if (!u?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!u.dobVerified18) {
    return res.status(403).json({
      error: 'Age verification required',
      code: 'AGE_VERIFICATION_REQUIRED',
    });
  }
  return next();
}
