import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const headerId = String(req.headers['x-request-id'] || '').trim();
  const requestId = headerId || randomUUID();

  const sessionUser = (req.session as any)?.user;
  const authUser = (req as any)?.user; // populated by your auth middleware
  const userId = authUser?.id ?? sessionUser?.id ?? null;

  (req as any).context = {
    requestId,
    userId,
    startedAt: Date.now(),
  };

  res.setHeader('X-Request-Id', requestId);
  next();
}
