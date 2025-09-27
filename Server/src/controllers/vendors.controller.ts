// Server/src/controllers/vendors.controller.ts
import type { Request, Response } from 'express';
import { z, type ZodError } from 'zod';
import { Op, UniqueConstraintError } from 'sequelize';
import { Vendor } from '../models/vendor.model.js';
import { ensureVendorStripeAccount, createAccountLink, stripeEnabled } from '../services/stripe.service.js';
import { applyVendorSchema } from '../validation/vendor.schema.js';
import { Order } from '../models/order.model.js';
import { OrderItem } from '../models/orderItem.model.js';

// ✅ NEW imports for vendor product endpoints
import { Product } from '../models/product.model.js';
import {
  listVendorProductsQuerySchema,
  type ListVendorProductsQuery,
  updateVendorProductFlagsSchema,
} from '../validation/vendorProducts.schema.js';

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

export async function getVendorOrders(req: Request, res: Response): Promise<void> {
  const u = (req as any).user ?? (req.session as any)?.user ?? null;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const vendor = await Vendor.findOne({ where: { userId: Number(u.id) } });
  if (!vendor) {
    res.status(404).json({ error: 'Vendor not found' });
    return;
  }

  const q = req.query as any;
  const page = Number(q?.page) > 0 ? Math.floor(Number(q.page)) : 1;
  const pageSize =
    Number(q?.pageSize) > 0 && Number(q.pageSize) <= 100
      ? Math.floor(Number(q.pageSize))
      : 20;

  // Optional date range (UTC ISO or YYYY-MM-DD)
  const from = q?.from ? new Date(String(q.from)) : null;
  const to = q?.to ? new Date(String(q.to)) : null;

  const whereRange: any = {};
  if (from && !Number.isNaN(from.getTime())) {
    whereRange.createdAt = { ...(whereRange.createdAt || {}), [Op.gte]: from };
  }
  if (to && !Number.isNaN(to.getTime())) {
    whereRange.createdAt = { ...(whereRange.createdAt || {}), [Op.lte]: to };
  }

  // Collect order items for this vendor, then join orders
  const { rows: items, count } = await OrderItem.findAndCountAll({
    where: { vendorId: Number(vendor.id) },
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const orderIds = [...new Set(items.map((i) => Number(i.orderId)))];
  const orders =
    orderIds.length > 0
      ? await Order.findAll({ where: { id: { [Op.in]: orderIds }, ...whereRange } })
      : [];

  const byId = new Map(orders.map((o) => [Number(o.id), o]));
  const grouped = new Map<number, typeof items>();
  for (const it of items) {
    const oid = Number(it.orderId);
    if (!byId.has(oid)) continue; // outside date range
    const arr = grouped.get(oid) ?? [];
    arr.push(it);
    grouped.set(oid, arr);
  }

  const list = Array.from(grouped.entries())
    .sort((a, b) => {
      const oa = byId.get(a[0]);
      const ob = byId.get(b[0]);
      const ta = oa?.createdAt ? new Date(String(oa.createdAt)).getTime() : 0;
      const tb = ob?.createdAt ? new Date(String(ob.createdAt)).getTime() : 0;
      return tb - ta;
    })
    .map(([orderId, its]) => {
      const o = byId.get(orderId)!;
      return {
        orderId,
        status: o.status,
        createdAt: o.createdAt,
        subtotalCents: o.subtotalCents,
        shippingCents: o.shippingCents,
        totalCents: o.totalCents,
        items: its.map((i) => ({
          productId: Number(i.productId),
          title: String(i.title),
          unitPriceCents: Number(i.unitPriceCents),
          quantity: Number(i.quantity),
          lineTotalCents: Number(i.lineTotalCents),
        })),
      };
    });

  res.json({
    page,
    pageSize,
    total: count,
    orders: list,
  });
}

/** -------------------------------------------------------------
 * NEW: Vendor products endpoints (used by Vendor Dashboard)
 * ------------------------------------------------------------*/

// Helper to ensure we have the logged-in user's vendor record
async function ensureVendorForUser(req: Request, res: Response) {
  const user = (req.session as any)?.user;
  if (!user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const vendor = await Vendor.findOne({ where: { userId: user.id } });
  if (!vendor) {
    res.status(403).json({ error: 'Vendor account required' });
    return null;
  }
  return { user, vendor };
}

// GET /vendors/me/products
export async function listMyProducts(req: Request, res: Response): Promise<void> {
  const ctx = await ensureVendorForUser(req, res);
  if (!ctx) return;

  // Prefer validated query from middleware; fallback parse if not present
  let q = (res.locals.query as ListVendorProductsQuery) ?? null;
  if (!q) {
    const parsed = listVendorProductsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query', details: zDetails(parsed.error) });
      return;
    }
    q = parsed.data;
  }

  const whereAnd: any[] = [{ vendorId: ctx.vendor.id }];
  // Optional status filter support (active/archived/all)
  if (q.status === 'active') whereAnd.push({ archivedAt: { [Op.is]: null } as any });
  if (q.status === 'archived') whereAnd.push({ archivedAt: { [Op.not]: null } as any });
  // Optional q (title search)
  if (q.q) whereAnd.push({ title: { [Op.iLike]: `%${q.q}%` } });

  // sort
  let order: any;
  if (q.sort === 'price_asc') order = [['priceCents', 'ASC'], ['id', 'ASC']];
  else if (q.sort === 'price_desc') order = [['priceCents', 'DESC'], ['id', 'DESC']];
  else if (q.sort === 'oldest') order = [['createdAt', 'ASC'], ['id', 'ASC']];
  else order = [['createdAt', 'DESC'], ['id', 'DESC']];

  const offset = (q.page - 1) * q.pageSize;

  const { rows, count } = await Product.findAndCountAll({
    where: { [Op.and]: whereAnd },
    order,
    offset,
    limit: q.pageSize,
    attributes: [
      'id',
      'title',
      'priceCents',
      'salePriceCents',
      'archivedAt',
      'createdAt',
      'updatedAt',
    ],
  });

  const items = rows.map((p: any) => ({
    id: Number(p.id),
    title: String(p.title),
    priceCents: Number(p.priceCents),
    onSale: p.salePriceCents != null,
    archived: p.archivedAt != null,
    primaryPhotoUrl: null, // can be filled via join to ProductImage if desired
    photoCount: undefined,
    createdAt: p.createdAt?.toISOString?.() ?? String(p.createdAt),
    updatedAt: p.updatedAt?.toISOString?.() ?? String(p.updatedAt),
  }));

  res.json({
    items,
    page: q.page,
    pageSize: q.pageSize,
    total: count,
    totalPages: Math.ceil(count / q.pageSize),
  });
}

// PUT /vendors/me/products/:id
export async function updateMyProductFlags(req: Request, res: Response): Promise<void> {
  const ctx = await ensureVendorForUser(req, res);
  if (!ctx) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid product id' });
    return;
  }

  const parsed = updateVendorProductFlagsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: zDetails(parsed.error) });
    return;
  }
  const { onSale, archived } = parsed.data;

  const prod = await Product.findOne({ where: { id, vendorId: ctx.vendor.id } });
  if (!prod) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const patch: any = {};
  // If you only treat sale via scheduled salePriceCents, you can remove this block.
  if (onSale !== undefined) {
    patch.salePriceCents = onSale
      ? Math.max(1, Number((prod as any).salePriceCents ?? 1))
      : null;
  }
  if (archived !== undefined) {
    patch.archivedAt = archived ? new Date() : null;
  }

  await (prod as any).update({ ...patch, updatedAt: new Date() });
  res.json({ ok: true });
}
