// Server/src/controllers/admin/admin.controller.ts
import type { Request, Response } from 'express';
import {
  listVendorAppsSvc,
  approveVendorSvc,
  rejectVendorSvc,
} from '../../services/admin/admin.service.js';

// If you already had real settings handlers elsewhere, keep/export them here.
// For now, keep the simple static settings used in Week-1:
export async function getSettings(_req: Request, res: Response): Promise<void> {
  res.json({ commissionPct: 0.08, minFeeCents: 75, holdHours: 48, holdCount: 3 });
}
export async function updateSettings(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true });
}

export async function listVendorApps(req: Request, res: Response): Promise<void> {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const out = await listVendorAppsSvc(page, pageSize);
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load applications', detail: e?.message });
  }
}

export async function approveVendor(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id || 0);

    // Pull current admin user id from the request (populated by your auth middleware).
    // Keep typing light to match repo style.
    const adminUserId = Number((req as any)?.user?.id ?? 0);
    if (!Number.isFinite(adminUserId) || adminUserId <= 0) {
      res.status(401).json({ error: 'Auth required' });
      return;
    }

    const out = await approveVendorSvc(id, adminUserId);
    if (!out.ok && (out as any).http) {
      res.status((out as any).http).json({ error: (out as any).error });
      return;
    }
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to approve vendor', detail: e?.message });
  }
}

export async function rejectVendor(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id || 0);
    const reason =
      typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : null;

    const out = await rejectVendorSvc(id, reason);
    if (!out.ok && (out as any).http) {
      res.status((out as any).http).json({ error: (out as any).error });
      return;
    }
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to reject vendor', detail: e?.message });
  }
}
