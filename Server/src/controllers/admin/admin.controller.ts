// Server/src/controllers/admin.controller.ts
import type { Request, Response } from 'express';
import { Vendor } from '../../models/vendor.model.js';
import { ensureVendorStripeAccount } from '../../services/stripe.service.js';

export async function listVendorApps(_req: Request, res: Response): Promise<void> {
  const items = await Vendor.findAll({
    where: { approvalStatus: 'pending' },
    order: [['createdAt', 'DESC']],
  });
  res.json({ items });
}

export async function approveVendor(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'Bad vendor id' });
    return;
  }

  const v = await Vendor.findByPk(id);
  if (!v) {
    res.status(404).json({ error: 'Vendor not found' });
    return;
  }

  v.approvalStatus = 'approved';

  // Ensure a Stripe Connect account exists; do NOT create the onboarding link here.
  const { accountId, error } = await ensureVendorStripeAccount({
    stripeAccountId: v.stripeAccountId,
    displayName: v.displayName,
  });

  if (accountId) v.stripeAccountId = accountId;

  await v.save();

  res.json({
    ok: true,
    stripeAccountId: v.stripeAccountId,
    note: error || undefined,
  });
}

export async function rejectVendor(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'Bad vendor id' });
    return;
  }

  const v = await Vendor.findByPk(id);
  if (!v) {
    res.status(404).json({ error: 'Vendor not found' });
    return;
  }

  v.approvalStatus = 'rejected';
  await v.save();

  res.json({ ok: true });
}

// Week-1: static settings; persist later.
export async function getSettings(_req: Request, res: Response): Promise<void> {
  res.json({ commissionPct: 0.08, minFeeCents: 75, holdHours: 48, holdCount: 3 });
}

export async function updateSettings(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true });
}
