// Server/src/controllers/vendors.controller.ts
import type {Request, Response} from 'express';
import {z, type ZodError} from 'zod';
import {Op, UniqueConstraintError} from 'sequelize';
import {Vendor} from '../models/vendor.model.js';
import {createAccountLink, ensureVendorStripeAccount, stripeEnabled} from '../services/stripe.service.js';
import {applyVendorSchema} from '../validation/vendor.schema.js';
import {Order} from '../models/order.model.js';
import {OrderItem} from '../models/orderItem.model.js';

/** -------------------------------------------------------------
 * Zod helpers
 * ------------------------------------------------------------*/
function zDetails(err: ZodError) {
  const treeify = (z as any).treeifyError;
  if (typeof treeify === 'function') {
    return treeify(err);
  }

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

function trimDashes(str: string): string {
  let start = 0;
  let end = str.length;
  while (start < end && str.charCodeAt(start) === 45) start++;
  while (end > start && str.charCodeAt(end - 1) === 45) end--;
  return str.slice(start, end);
}

function slugify(input: string): string {
  const s = String(input ?? '').trim().toLowerCase();
  const mid = s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
  const base = trimDashes(mid);
  return base ? base.slice(0, 140) : `vendor-${Date.now()}`;
}

function suggestSlugs(base: string, take = 2): string[] {
  const suggestions: string[] = [];
  for (let n = 1; suggestions.length < take && n < 100; n += 1) {
    suggestions.push(`${base}-${n}`);
  }
  return suggestions;
}

/** -------------------------------------------------------------
 * applyVendor helpers (to reduce CC)
 * ------------------------------------------------------------*/
function parseApplyBody(req: Request, res: Response) {
  const parsed = applyVendorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: zDetails(parsed.error) });
    return null;
  }
  return parsed.data;
}

async function getExistingForUser(userId: number) {
  const existing = await Vendor.findOne({ where: { userId } });
  const excludeId = existing ? { [Op.ne]: existing.id } : undefined;
  return { existing, excludeId };
}

async function guardConflicts(
  args: { displayName: string; slug: string },
  excludeId: any,
  res: Response
): Promise<boolean> {
  const { displayName, slug } = args;

  const [slugExists, nameExists] = await Promise.all([
    Vendor.findOne({
      where: { slug: { [Op.iLike]: slug }, ...(excludeId ? { id: excludeId } : {}) } as any,
      attributes: ['id', 'slug'],
    }),
    Vendor.findOne({
      where: { displayName: { [Op.iLike]: displayName }, ...(excludeId ? { id: excludeId } : {}) } as any,
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
    return true;
  }
  if (nameExists) {
    res.status(409).json({
      ok: false,
      code: 'DISPLAY_NAME_TAKEN',
      message: 'That display name is taken.',
    });
    return true;
  }
  return false;
}

async function saveExistingVendor(
  existing: InstanceType<typeof Vendor>,
  fields: {
    displayName: string;
    slug: string;
    bio: string | null;
    logoUrl: string | null;
    country: string | null;
  }
) {
  existing.displayName = fields.displayName;
  existing.slug = fields.slug;
  existing.bio = fields.bio;
  existing.logoUrl = fields.logoUrl;
  existing.country = fields.country;
  existing.approvalStatus = 'pending';
  (existing as any).approvedBy = null;
  (existing as any).approvedAt = null;
  (existing as any).rejectedReason = null;
  await existing.save();
  return existing;
}

async function createNewVendor(
  userId: number,
  fields: {
    displayName: string;
    slug: string;
    bio: string | null;
    logoUrl: string | null;
    country: string | null;
  }
) {
  const now = new Date();
  return await Vendor.create({
    userId,
    displayName: fields.displayName,
    slug: fields.slug,
    bio: fields.bio,
    logoUrl: fields.logoUrl,
    country: fields.country,
    approvalStatus: 'pending',
    approvedBy: null,
    approvedAt: null,
    rejectedReason: null,
    createdAt: now,
    updatedAt: now,
  } as any);
}

function handleUniqueConstraint(e: unknown, slug: string, res: Response): boolean {
  if (!(e instanceof UniqueConstraintError)) return false;
  const msg = String((e as any)?.message || '').toLowerCase();
  if (msg.includes('slug')) {
    res.status(409).json({
      ok: false,
      code: 'SLUG_TAKEN',
      message: 'That shop URL is taken.',
      suggestions: suggestSlugs(slug),
    });
    return true;
  }
  if (msg.includes('display') || msg.includes('name')) {
    res.status(409).json({
      ok: false,
      code: 'DISPLAY_NAME_TAKEN',
      message: 'That display name is taken.',
    });
    return true;
  }
  return false;
}

/** -------------------------------------------------------------
 * User endpoints
 * ------------------------------------------------------------*/
export async function applyVendor(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  const data = parseApplyBody(req, res);
  if (!data) return;

  const displayName = data.displayName.trim();
  const slug = slugify(displayName);

  try {
    const userId = (req as any).user.id as number;
    const { existing, excludeId } = await getExistingForUser(userId);

    const conflicted = await guardConflicts({ displayName, slug }, excludeId, res);
    if (conflicted) return;

    if (existing) {
      const saved = await saveExistingVendor(existing, {
        displayName,
        slug,
        bio: data.bio ?? null,
        logoUrl: data.logoUrl ?? null,
        country: data.country ?? null,
      });
      res.json({ ok: true, vendorId: Number(saved.id), status: saved.approvalStatus });
      return;
    }

    const created = await createNewVendor(userId, {
      displayName,
      slug,
      bio: data.bio ?? null,
      logoUrl: data.logoUrl ?? null,
      country: data.country ?? null,
    });

    res.status(201).json({ ok: true, vendorId: Number(created.id), status: 'pending' });
  } catch (e: any) {
    if (handleUniqueConstraint(e, slug, res)) return;
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

  const from = q?.from ? new Date(String(q.from)) : null;
  const to = q?.to ? new Date(String(q.to)) : null;

  const whereRange: any = {};
  if (from && !Number.isNaN(from.getTime())) {
    whereRange.createdAt = { ...(whereRange.createdAt || {}), [Op.gte]: from };
  }
  if (to && !Number.isNaN(to.getTime())) {
    whereRange.createdAt = { ...(whereRange.createdAt || {}), [Op.lte]: to };
  }

  const ALLOWED: ReadonlySet<string> = new Set([
    'pending_payment',
    'paid',
    'failed',
    'refunded',
    'cancelled',
    'shipped',
  ]);
  const reqStatus = typeof q?.status === 'string' && ALLOWED.has(q.status) ? (q.status as string) : undefined;

  const itemWhere: any = { vendorId: Number(vendor.id) };
  if (reqStatus === 'shipped') {
    itemWhere.shippedAt = { [Op.ne]: null };
  }

  const { rows: items } = await OrderItem.findAndCountAll({
    where: itemWhere,
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const orderIds = [...new Set(items.map((i) => Number(i.orderId)))];

  const orderWhere: any = { id: { [Op.in]: orderIds }, ...whereRange };
  if (reqStatus && reqStatus !== 'shipped') {
    orderWhere.status = reqStatus;
  }

  const orders =
    orderIds.length > 0
      ? await Order.findAll({ where: orderWhere })
      : [];

  const byId = new Map(orders.map((o) => [Number(o.id), o]));
  const grouped = new Map<number, typeof items>();

  for (const it of items) {
    const oid = Number(it.orderId);
    if (!byId.has(oid)) continue;
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
          id: Number((i as any).id),
          orderItemId: Number((i as any).id),
          orderId: Number((i as any).orderId),
          vendorId: Number((i as any).vendorId),
          productId: Number((i as any).productId),
          title: String((i as any).title ?? (i as any).productTitle ?? `Item #${(i as any).id}`),
          unitPriceCents: Number((i as any).unitPriceCents),
          quantity: Number((i as any).quantity),
          lineTotalCents: Number((i as any).lineTotalCents),
          shipCarrier: (i as any).shipCarrier ?? null,
          shipTracking: (i as any).shipTracking ?? null,
          shippedAt: (i as any).shippedAt ?? null,
          deliveredAt: (i as any).deliveredAt ?? null,
        })),
      };
    });

  res.json({
    page,
    pageSize,
    total: list.length,
    orders: list,
  });
}
