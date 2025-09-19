// Server/src/controllers/admin.controller.ts
import type { Request, Response } from 'express';

export async function listVendorApps(_req: Request, res: Response): Promise<void> {
  res.json({ items: [] });
}
export async function approveVendor(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true });
}
export async function rejectVendor(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true });
}
export async function getSettings(_req: Request, res: Response): Promise<void> {
  res.json({ commissionPct: 0.08, minFeeCents: 75, holdHours: 48, holdCount: 3 });
}
export async function updateSettings(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true });
}
