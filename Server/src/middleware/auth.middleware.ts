// Server/src/middleware/auth.middleware.ts
import type { Request, Response, NextFunction } from 'express';

export async function requireAuth(_req: Request, _res: Response, next: NextFunction): Promise<void> {
  // TODO: real auth; allow all for now
  next();
}
export async function requireAdmin(_req: Request, _res: Response, next: NextFunction): Promise<void> {
  // TODO: check role; allow all for now
  next();
}
