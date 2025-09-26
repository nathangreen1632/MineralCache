// Server/src/middleware/auth.middleware.ts
import type { Request, Response, NextFunction } from 'express';
import { Vendor } from '../models/vendor.model.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  (req as any).user = u;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const u = (req.session as any)?.user;
  if (!u?.id || u.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  (req as any).user = u;
  next();
}

export async function requireVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const vendor = await Vendor.findOne({ where: { userId: u.id } });
  if (!vendor) {
    res.status(403).json({ error: 'Vendor account required' });
    return;
  }
  (req as any).user = u;
  (req as any).vendor = vendor;
  next();
}
