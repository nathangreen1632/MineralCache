// Server/src/controllers/admin/admin.controller.ts
import type { Request, Response } from 'express';
import {
  listVendorAppsSvc,
  approveVendorSvc,
  rejectVendorSvc,
} from '../../services/admin/admin.service.js';

// 🆕 Admin settings model + validation
import { z, type ZodError } from 'zod';
import { AdminSettings } from '../../models/adminSettings.model.js';
import { updateAdminSettingsSchema } from '../../validation/adminSettings.schema.js';

// If you already had real settings handlers elsewhere, keep/export them here.
// For now, keep the simple static settings used in Week-1:
export async function getSettings(_req: Request, res: Response): Promise<void> {
  res.json({ commissionPct: 0.08, minFeeCents: 75, holdHours: 48, holdCount: 3 });
}
export async function updateSettings(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true });
}

/** ---------------------------------------------
 * 🆕 Zod error details helper (stable shape)
 * --------------------------------------------*/
function zDetails(err: ZodError) {
  const anyZ = z as any;
  if (typeof anyZ.treeifyError === 'function') return anyZ.treeifyError(err);
  return {
    issues: err.issues.map((i) => ({
      path: Array.isArray(i.path) ? i.path.join('.') : String(i.path ?? ''),
      message: i.message,
      code: i.code,
    })),
  };
}

/** ---------------------------------------------
 * 🆕 Admin Settings DTO shaping for client
 * --------------------------------------------*/
function toDto(s: AdminSettings) {
  return {
    commission: {
      bps: Number(s.commission_bps),
      minFeeCents: Number(s.min_fee_cents),
    },
    shippingDefaults: {
      flatCents: Number(s.ship_flat_cents),
      perItemCents: Number(s.ship_per_item_cents),
      freeThresholdCents:
        s.ship_free_threshold_cents === null ? null : Number(s.ship_free_threshold_cents),
      handlingCents: s.ship_handling_cents === null ? null : Number(s.ship_handling_cents),
      currency: String(s.currency),
    },
    stripeEnabled: Boolean(s.stripe_enabled),
    updatedAt: s.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

/** ---------------------------------------------
 * 🆕 GET /admin/settings — commission/min fee + shipping defaults + stripe flag
 * --------------------------------------------*/
export async function getAdminSettings(_req: Request, res: Response): Promise<void> {
  try {
    // unified currency fallback (CURRENCY preferred, then STRIPE_CURRENCY, then 'usd')
    const envCurrency = (process.env.CURRENCY || process.env.STRIPE_CURRENCY || 'usd').toLowerCase();

    let s = await AdminSettings.findByPk(1);
    // Fallback row in case migration wasn’t run yet — uses env defaults
    s ??= AdminSettings.build({
      id: 1,
      commission_bps: 800,
      min_fee_cents: 75,
      stripe_enabled: String(process.env.STRIPE_ENABLED ?? '').toLowerCase() === 'true',
      currency: envCurrency, // ← unified fallback
      ship_flat_cents: Number(process.env.SHIP_FLAT_CENTS ?? 0),
      ship_per_item_cents: Number(process.env.SHIP_PER_ITEM_CENTS ?? 0),
      ship_free_threshold_cents: process.env.SHIP_FREE_THRESHOLD_CENTS
        ? Number(process.env.SHIP_FREE_THRESHOLD_CENTS)
        : null,
      ship_handling_cents: process.env.SHIP_HANDLING_CENTS
        ? Number(process.env.SHIP_HANDLING_CENTS)
        : null,
    });
    res.json(toDto(s));
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load settings', detail: e?.message });
  }
}

/** ---------------------------------------------
 * 🆕 PATCH /admin/settings — toggle flags & update shipping defaults
 * --------------------------------------------*/
export async function patchAdminSettings(req: Request, res: Response): Promise<void> {
  try {
    const parsed = updateAdminSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: zDetails(parsed.error) });
      return;
    }

    // unified currency fallback (CURRENCY preferred, then STRIPE_CURRENCY, then 'usd')
    const envCurrency = (process.env.CURRENCY || process.env.STRIPE_CURRENCY || 'usd').toLowerCase();

    // Ensure singleton row exists
    let s = await AdminSettings.findByPk(1);
    s ??= await AdminSettings.create({
      id: 1,
      commission_bps: 800,
      min_fee_cents: 75,
      stripe_enabled: String(process.env.STRIPE_ENABLED ?? '').toLowerCase() === 'true',
      currency: envCurrency, // ← unified fallback
      ship_flat_cents: Number(process.env.SHIP_FLAT_CENTS ?? 0),
      ship_per_item_cents: Number(process.env.SHIP_PER_ITEM_CENTS ?? 0),
      ship_free_threshold_cents: process.env.SHIP_FREE_THRESHOLD_CENTS
        ? Number(process.env.SHIP_FREE_THRESHOLD_CENTS)
        : null,
      ship_handling_cents: process.env.SHIP_HANDLING_CENTS
        ? Number(process.env.SHIP_HANDLING_CENTS)
        : null,
    });

    const v = parsed.data;

    // commission
    if (v.commissionBps !== undefined) s.commission_bps = Number(v.commissionBps);
    if (v.minFeeCents !== undefined) s.min_fee_cents = Number(v.minFeeCents);

    // stripe flag
    if (v.stripeEnabled !== undefined) s.stripe_enabled = Boolean(v.stripeEnabled);

    // currency
    if (v.currency !== undefined) s.currency = String(v.currency);

    // shipping
    if (v.shipFlatCents !== undefined) s.ship_flat_cents = Number(v.shipFlatCents);
    if (v.shipPerItemCents !== undefined) s.ship_per_item_cents = Number(v.shipPerItemCents);
    if (v.shipFreeThresholdCents !== undefined) {
      s.ship_free_threshold_cents =
        v.shipFreeThresholdCents === null ? null : Number(v.shipFreeThresholdCents);
    }
    if (v.shipHandlingCents !== undefined) {
      s.ship_handling_cents = v.shipHandlingCents === null ? null : Number(v.shipHandlingCents);
    }

    await s.save();
    res.json(toDto(s));
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update settings', detail: e?.message });
  }
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
