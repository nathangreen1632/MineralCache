// Server/src/controllers/admin/admin.controller.ts
import type { Request, Response } from 'express';
import {
  listVendorAppsSvc,
  approveVendorSvc,
  rejectVendorSvc,
} from '../../services/admin/admin.service.js';

// ✅ Centralized settings logic (ENV+DB merge, cache)
import {
  getEffectiveSettings,
  updateAdminSettings,
  invalidateAdminSettingsCache,
} from '../../services/settings.service.js';
import {
  updateAdminSettingsSchema,
  type UpdateAdminSettingsDto,
} from '../../validation/adminSettings.schema.js';

/** ---------------------------------------------
 * Admin Settings DTO shaping for client (preserves your shape)
 * --------------------------------------------*/
function toDtoFromEffective(s: Awaited<ReturnType<typeof getEffectiveSettings>>) {
  return {
    commission: {
      bps: Number(s.commission_bps),
      minFeeCents: Number(s.min_fee_cents),
    },
    tax: {
      bps: Number(s.tax_rate_bps ?? 0),
      label: (s.tax_label ?? null),
      // optional: show feature flag if your UI wants it
      enabled: Boolean(s.tax_enabled),
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
    // keep an updatedAt for UI; effective settings are computed, so synthesize a timestamp
    updatedAt: new Date().toISOString(),
  };
}

/** ---------------------------------------------
 * GET /api/admin/settings
 * --------------------------------------------*/
export async function getAdminSettings(_req: Request, res: Response): Promise<void> {
  try {
    const effective = await getEffectiveSettings();
    res.json(toDtoFromEffective(effective));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to load settings', detail: message });
  }
}

/** ---------------------------------------------
 * PATCH /api/admin/settings
 * --------------------------------------------*/
export async function patchAdminSettings(req: Request, res: Response): Promise<void> {
  try {
    const parsed = updateAdminSettingsSchema.safeParse(req.body as UpdateAdminSettingsDto);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const updatedEffective = await updateAdminSettings(parsed.data);
    invalidateAdminSettingsCache(); // ensure subsequent reads are fresh
    res.json(toDtoFromEffective(updatedEffective));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to update settings', detail: message });
  }
}

/** ---------------------------------------------
 * Vendor applications (existing handlers)
 * --------------------------------------------*/
export async function listVendorApps(req: Request, res: Response): Promise<void> {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const out = await listVendorAppsSvc(page, pageSize);
    res.json(out);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to load applications', detail: message });
  }
}

export async function approveVendor(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id || 0);
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
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to approve vendor', detail: message });
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
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to reject vendor', detail: message });
  }
}
