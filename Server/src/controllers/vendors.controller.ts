// Server/src/controllers/vendors.controller.ts
import type { Request, Response } from 'express';
import { z, type ZodError } from 'zod';
import { Op, UniqueConstraintError } from 'sequelize';
import { Vendor } from '../models/vendor.model.js';
import {
  ensureVendorStripeAccount,
  createAccountLink,
  stripeEnabled,
} from '../services/stripe.service.js';
import { applyVendorSchema } from '../validation/vendor.schema.js';

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

function suggestSlugs(base: string, take = 2): string[] {
  const suggestions: string[] = [];
  for (let n = 1; suggestions.length < take && n < 100; n += 1) {
    suggestions.push(`${base}-${n}`);
  }
  return suggestions;
}

/** -------------------------------------------------------------
 * User endpoints
 * ------------------------------------------------------------*/
export async function applyVendor(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  // ✅ use shared schema
  const parsed = applyVendorSchema.safeParse(req.body);
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

    // Friendly pre-checks for duplicates (exclude own record on update)
    const excludeId = existing ? { [Op.ne]: existing.id } : undefined;

    const [slugExists, nameExists] = await Promise.all([
      Vendor.findOne({
        where: {
          slug: { [Op.iLike]: slug },
          ...(excludeId ? { id: excludeId } : {}),
        } as any,
        attributes: ['id', 'slug'],
      }),
      Vendor.findOne({
        where: {
          displayName: { [Op.iLike]: displayName },
          ...(excludeId ? { id: excludeId } : {}),
        } as any,
        attributes: ['id', 'displayName'],
      }),
    ]);

    if (slugExists) {
      res.status(409).json({
        ok: false,
        code: 'SLUG_TAKEN',
        message: 'That shop URL is taken.',
        suggestions: suggestSlugs(slug),
      });
      return;
    }
    if (nameExists) {
      res.status(409).json({
        ok: false,
        code: 'DISPLAY_NAME_TAKEN',
        message: 'That display name is taken.',
      });
      return;
    }

    if (existing) {
      existing.displayName = displayName;
      existing.slug = slug;
      existing.bio = data.bio ?? null;
      existing.logoUrl = data.logoUrl ?? null;
      existing.country = data.country ?? null;
      existing.approvalStatus = 'pending';
      // Reset audit fields on resubmission
      (existing as any).approvedBy = null;
      (existing as any).approvedAt = null;
      (existing as any).rejectedReason = null;

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
      // audit fields start empty
      approvedBy: null,
      approvedAt: null,
      rejectedReason: null,
      createdAt: now,
      updatedAt: now,
    } as any);

    res.status(201).json({ ok: true, vendorId: Number(created.id), status: 'pending' });
  } catch (e: any) {
    // DB-level unique collision fallback
    if (e instanceof UniqueConstraintError) {
      const msg = String(e.message || '').toLowerCase();
      if (msg.includes('slug')) {
        res.status(409).json({
          ok: false,
          code: 'SLUG_TAKEN',
          message: 'That shop URL is taken.',
          suggestions: suggestSlugs(slug),
        });
        return;
      }
      if (msg.includes('display') || msg.includes('name')) {
        res.status(409).json({
          ok: false,
          code: 'DISPLAY_NAME_TAKEN',
          message: 'That display name is taken.',
        });
        return;
      }
    }
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
