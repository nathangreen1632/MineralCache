// Server/src/middleware/auth.middleware.ts
import type { Request, Response, NextFunction } from 'express';
import { Vendor } from '../models/vendor.model.js';

/** Unified reader for auth context coming from req.user, session.user, req.auth, and req.vendor */
function readAuth(req: Request) {
  const auth = (req as any).auth ?? null;
  const sessionUser = (req.session as any)?.user ?? null;
  const user = (req as any).user ?? sessionUser ?? auth ?? null;
  const vendor = (req as any).vendor ?? null;

  const role = (user?.role ?? auth?.role ?? '').toString().toLowerCase();
  const userId =
    (user?.id && Number.isFinite(user.id) && Number(user.id)) ||
    (auth?.userId && Number.isFinite(auth.userId) && Number(auth.userId)) ||
    null;

  const vendorId =
    (vendor?.id && Number.isFinite(vendor.id) && Number(vendor.id)) ||
    (auth?.vendorId && Number.isFinite(auth.vendorId) && Number(auth.vendorId)) ||
    null;

  const isAdmin = role === 'admin' || role === 'superadmin' || role === 'owner';
  const isVendor = vendorId != null;

  return { user, vendor, userId, vendorId, role, isAdmin, isVendor };
}

/** Ensure req.vendor is populated for the current user (and mirror vendorId onto req.user if missing). */
async function ensureVendorOnReq(req: Request, userId: number): Promise<boolean> {
  if ((req as any).vendor) return true;

  const vendor = await Vendor.findOne({ where: { userId } });
  if (!vendor) return false;

  (req as any).vendor = vendor;

  // Keep downstream code that relies on user.vendorId working
  const vId = Number((vendor as any).id);
  if (Number.isFinite(vId) && vId > 0) {
    try {
      const u = (req as any).user ?? ((req.session as any)?.user ?? null);
      if (u && u.vendorId == null) {
        u.vendorId = vId;
        (req as any).user = u;
      }
    } catch {
      // ignore if user object is frozen/readonly; req.vendor is still present
    }
  }
  return true;
}

/** Require any authenticated user */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId, user } = readAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!(req as any).user && user) (req as any).user = user;
  next();
}

/** Require admin (admin/superadmin/owner) */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { isAdmin, user } = readAuth(req);
  if (!isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (!(req as any).user && user) (req as any).user = user;
  next();
}

/** Require a vendor account (attaches req.vendor and mirrors vendorId onto req.user when possible) */
export async function requireVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId, user } = readAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const ok = await ensureVendorOnReq(req, userId);
  if (!ok) {
    res.status(403).json({ error: 'Vendor account required' });
    return;
  }
  if (!(req as any).user && user) (req as any).user = user;
  next();
}

/** Allow admins OR the current vendor (used on fulfillment endpoints) */
export async function requireAdminOrVendorOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId, isAdmin, user } = readAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (isAdmin) {
    if (!(req as any).user && user) (req as any).user = user;
    next();
    return;
  }
  const ok = await ensureVendorOnReq(req, userId);
  if (!ok) {
    res.status(403).json({ error: 'Vendor account required' });
    return;
  }
  if (!(req as any).user && user) (req as any).user = user;
  next();
}
