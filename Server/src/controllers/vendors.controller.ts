// Server/src/controllers/vendors.controller.ts
import type { Request, Response } from 'express';
import { z, type ZodError } from 'zod';
import { Op } from 'sequelize';
import { Vendor } from '../models/vendor.model.js';
import {
  ensureVendorStripeAccount,
  createAccountLink,
  stripeEnabled,
} from '../services/stripe.service.js';

/** -------------------------------------------------------------
 * Zod helpers
 * ------------------------------------------------------------*/
function zDetails(err: ZodError) {
  const treeify = (z as any).treeifyError;
  if (typeof treeify === 'function') {
    return treeify(err);
  }
  // Fallback that avoids deprecated `.flatten()`
  const issues = err.issues.map((i) => ({
    path: Array.isArray(i.path) ? i.path.join('.') : String(i.path ?? ''),
    message: i.message,
    code: i.code,
  }));
  return { issues };
}

/** -------------------------------------------------------------
 * Schemas
 * ------------------------------------------------------------*/
const ApplySchema = z.object({
  displayName: z.string().min(2).max(120),
  bio: z.string().max(5000).optional().nullable(),
  // Validate URL without deprecated APIs
  logoUrl: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .refine((v) => v == null || z.url().safeParse(v).success, { message: 'Invalid URL' }),
  country: z.string().length(2).optional().nullable(),
});

/** -------------------------------------------------------------
 * Helpers (auth + slug)
 * ------------------------------------------------------------*/
function ensureAuthed(req: Request, res: Response): req is Request & {
  user: { id: number; role: 'buyer' | 'vendor' | 'admin'; dobVerified18: boolean; email?: string };
} {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  (req as any).user = u;
  return true;
}

function slugify(input: string): string {
  const s = String(input || '').trim().toLowerCase();
  const base = s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+)|(-+$)/g, '');
  if (base.length > 0) {
    return base.slice(0, 140);
  }
  return `vendor-${Date.now()}`;
}

/** -------------------------------------------------------------
 * User endpoints
 * ------------------------------------------------------------*/
export async function applyVendor(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  const parsed = ApplySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: zDetails(parsed.error) });
    return;
  }

  const data = parsed.data;
  const displayName = data.displayName.trim();
  const slug = slugify(displayName);

  try {
    // If user has an existing vendor record, update it and reset to pending
    const existing = await Vendor.findOne({ where: { userId: (req as any).user.id } });
    if (existing) {
      existing.displayName = displayName;
      existing.slug = slug;
      existing.bio = data.bio ?? null;
      existing.logoUrl = data.logoUrl ?? null;
      existing.country = data.country ?? null;
      existing.approvalStatus = 'pending';
      await existing.save();

      res.json({ ok: true, vendorId: Number(existing.id), status: existing.approvalStatus });
      return;
    }

    // Create a new vendor application
    const now = new Date();
    const created = await Vendor.create({
      userId: (req as any).user.id,
      displayName,
      slug,
      bio: data.bio ?? null,
      logoUrl: data.logoUrl ?? null,
      country: data.country ?? null,
      approvalStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    } as any);

    res.status(201).json({ ok: true, vendorId: Number(created.id), status: 'pending' });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to submit vendor application', detail: e?.message });
  }
}

export async function getMyVendor(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;
  try {
    const vendor = await Vendor.findOne({ where: { userId: (req as any).user.id } });
    res.json({ vendor });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load vendor', detail: e?.message });
  }
}

export async function linkStripeOnboarding(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  try {
    const vendor = await Vendor.findOne({ where: { userId: (req as any).user.id } });
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }
    if (vendor.approvalStatus !== 'approved') {
      res.status(400).json({ error: 'Vendor not approved yet' });
      return;
    }

    if (!stripeEnabled) {
      res.json({ onboardingUrl: null, enabled: false, message: 'Stripe not configured' });
      return;
    }

    const ensured = await ensureVendorStripeAccount({
      stripeAccountId: vendor.stripeAccountId,
      displayName: vendor.displayName,
    });

    if (!ensured.accountId) {
      res.status(502).json({
        onboardingUrl: null,
        enabled: true,
        error: ensured.error || 'Unable to ensure Connect account',
      });
      return;
    }

    if (ensured.accountId !== vendor.stripeAccountId) {
      vendor.stripeAccountId = ensured.accountId;
      await vendor.save();
    }

    const platformBaseUrl = process.env.PLATFORM_URL || 'http://localhost:5173';
    const link = await createAccountLink({ accountId: ensured.accountId, platformBaseUrl });
    if (!link.url) {
      res.status(502).json({
        onboardingUrl: null,
        enabled: true,
        error: link.error || 'Unable to create onboarding link',
      });
      return;
    }

    res.json({ onboardingUrl: link.url, enabled: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to create onboarding link', detail: e?.message });
  }
}

export async function getVendorBySlug(_req: Request, res: Response): Promise<void> {
  // TODO: implement lookup by slug and return vendor profile + latest products
  res.json({ vendor: null });
}

export async function getVendorOrders(_req: Request, res: Response): Promise<void> {
  // TODO: list vendor’s orders (scoped to vendorId of the authed vendor)
  res.json({ orders: [] });
}

/** -------------------------------------------------------------
 * Admin endpoints (mount behind requireAdmin in routes)
 * ------------------------------------------------------------*/
export async function listVendorApps(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);

  const validPage = Number.isFinite(page) && page > 0 ? page : 1;
  const validSize = Number.isFinite(pageSize) && pageSize > 0 && pageSize <= 100 ? pageSize : 20;

  try {
    const { rows, count } = await Vendor.findAndCountAll({
      where: { approvalStatus: { [Op.in]: ['pending', 'rejected'] } },
      order: [['createdAt', 'DESC']],
      offset: (validPage - 1) * validSize,
      limit: validSize,
    });
    res.json({ items: rows, total: count, page: validPage, pageSize: validSize });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load applications', detail: e?.message });
  }
}

export async function approveVendor(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id || 0);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'Bad vendor id' });
    return;
  }

  try {
    const vendor = await Vendor.findByPk(id);
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    vendor.approvalStatus = 'approved';
    await vendor.save();

    if (!stripeEnabled) {
      res.json({ ok: true, enabled: false, onboardingUrl: null, message: 'Stripe not configured' });
      return;
    }

    const ensured = await ensureVendorStripeAccount({
      stripeAccountId: vendor.stripeAccountId,
      displayName: vendor.displayName,
    });

    if (!ensured.accountId) {
      res.json({
        ok: true,
        enabled: true,
        onboardingUrl: null,
        warning: ensured.error || 'Unable to ensure Connect account',
      });
      return;
    }

    if (ensured.accountId !== vendor.stripeAccountId) {
      vendor.stripeAccountId = ensured.accountId;
      await vendor.save();
    }

    const platformBaseUrl = process.env.PLATFORM_URL || 'http://localhost:5173';
    const link = await createAccountLink({ accountId: ensured.accountId, platformBaseUrl });
    if (!link.url) {
      res.json({
        ok: true,
        enabled: true,
        onboardingUrl: null,
        warning: link.error || 'Unable to create onboarding link',
      });
      return;
    }

    // Email/log placeholder for onboarding link
    // eslint-disable-next-line no-console
    console.log(`[email] Send onboarding link to vendor ${vendor.id}: ${link.url}`);

    res.json({ ok: true, enabled: true, onboardingUrl: link.url });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to approve vendor', detail: e?.message });
  }
}

export async function rejectVendor(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id || 0);
  const reason =
    typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : null;

  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'Bad vendor id' });
    return;
  }

  try {
    const vendor = await Vendor.findByPk(id);
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    vendor.approvalStatus = 'rejected';
    await vendor.save();

    // Email/log placeholder
    if (reason) {
      // eslint-disable-next-line no-console
      console.log(`[email] Vendor ${vendor.id} rejected: ${reason}`);
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to reject vendor', detail: e?.message });
  }
}
