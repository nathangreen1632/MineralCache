import type { Request, Response, NextFunction } from 'express';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  req.user = u;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const u = (req.session as any)?.user;
  if (!u?.id || u.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  req.user = u;
  next();
}
