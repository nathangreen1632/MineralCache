// Server/src/controllers/vendors.controller.ts
import type { Request, Response } from 'express';

export async function applyVendor(_req: Request, res: Response): Promise<void> {
  // TODO: persist application
  res.json({ ok: true });
}
export async function getMyVendor(_req: Request, res: Response): Promise<void> {
  res.json({ vendor: null });
}
export async function linkStripeOnboarding(_req: Request, res: Response): Promise<void> {
  // TODO: create/connect Express account & return onboarding link
  res.json({ onboardingUrl: null, enabled: false });
}
export async function getVendorBySlug(_req: Request, res: Response): Promise<void> {
  res.json({ vendor: null });
}
export async function getVendorOrders(_req: Request, res: Response): Promise<void> {
  res.json({ orders: [] });
}
