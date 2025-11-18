// Server/src/services/admin.service.ts
import { Op } from 'sequelize';
import { Vendor } from '../../models/vendor.model.js';
import { User } from '../../models/user.model.js';
import {
  ensureVendorStripeAccount,
  createAccountLink,
  stripeEnabled,
} from '../stripe.service.js';
import { log } from '../log.service.js';

export async function listVendorAppsSvc(
  page: number,
  pageSize: number,
  q?: string | null,
  status?: 'pending' | 'approved' | 'rejected' | null
) {
  const validPage = Number.isFinite(page) && page > 0 ? page : 1;
  const validSize =
    Number.isFinite(pageSize) && pageSize > 0 && pageSize <= 100 ? pageSize : 20;

  const where: any = {};

  if (status) {
    where.approvalStatus = status;
  }

  const trimmed = q?.trim();
  if (trimmed) {
    const like = `%${trimmed}%`;
    where[Op.or] = [
      { displayName: { [Op.iLike]: like } },
      { slug: { [Op.iLike]: like } },
      { '$owner.email$': { [Op.iLike]: like } },
    ];
  }

  const { rows, count } = await Vendor.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    offset: (validPage - 1) * validSize,
    limit: validSize,
    include: [
      {
        model: User,
        as: 'owner',
        attributes: ['id', 'email'],
        required: false,
      },
    ],
  });

  const items = rows.map((vendor) => {
    const json = vendor.toJSON() as any;
    const owner = (vendor as any).owner as { email?: string | null } | undefined;
    return { ...json, email: owner?.email ?? null };
  });

  return { items, total: count, page: validPage, pageSize: validSize };
}

export async function approveVendorSvc(id: number, adminUserId: number) {
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, http: 400, error: 'Bad vendor id' as const };
  }
  if (!Number.isFinite(adminUserId) || adminUserId <= 0) {
    return { ok: false, http: 400, error: 'Bad admin id' as const };
  }

  const vendor = await Vendor.findByPk(id);
  if (!vendor) {
    return { ok: false, http: 404, error: 'Vendor not found' as const };
  }

  vendor.approvalStatus = 'approved';
  vendor.approvedBy = adminUserId;
  vendor.approvedAt = new Date();
  vendor.rejectedReason = null;
  await vendor.save();

  const owner = await User.findByPk(Number(vendor.userId), { attributes: ['id', 'role'] });
  const nextRole =
    String(owner?.role || '').toLowerCase() === 'buyer'
      ? 'vendor'
      : (owner?.role as 'buyer' | 'vendor' | 'admin');

  await User.update(
    { role: nextRole, vendorId: Number(vendor.id) },
    { where: { id: Number(vendor.userId) } }
  );

  if (!stripeEnabled) {
    return {
      ok: true,
      enabled: false,
      onboardingUrl: null as string | null,
      message: 'Stripe not configured',
    };
  }

  const ensured = await ensureVendorStripeAccount({
    stripeAccountId: vendor.stripeAccountId,
    displayName: vendor.displayName,
  });

  if (!ensured.accountId) {
    return {
      ok: true,
      enabled: true,
      onboardingUrl: null as string | null,
      warning: ensured.error || 'Unable to ensure Connect account',
    };
  }

  if (ensured.accountId !== vendor.stripeAccountId) {
    vendor.stripeAccountId = ensured.accountId;
    await vendor.save();
  }

  const link = await createAccountLink({
    accountId: ensured.accountId,
    platformBaseUrl:
      process.env.PLATFORM_BASE_URL ||
      process.env.PUBLIC_BASE_URL ||
      process.env.CLIENT_BASE_URL ||
      'http://localhost:5173',
  });

  if (!link.url) {
    return {
      ok: true,
      enabled: true,
      onboardingUrl: null as string | null,
      warning: link.error || 'Unable to create onboarding link',
    };
  }

  log.info(
    `[audit] Vendor ${vendor.id} approved by admin ${adminUserId} at ${new Date().toISOString()}`
  );
  log.info(`[email] Send onboarding link to vendor ${vendor.id}: ${link.url}`);

  return { ok: true, enabled: true, onboardingUrl: link.url };
}

export async function rejectVendorSvc(id: number, reason: string | null) {
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, http: 400, error: 'Bad vendor id' as const };
  }

  const vendor = await Vendor.findByPk(id);
  if (!vendor) {
    return { ok: false, http: 404, error: 'Vendor not found' as const };
  }

  const trimmed = typeof reason === 'string' ? reason.trim() : null;

  vendor.approvalStatus = 'rejected';
  vendor.rejectedReason = trimmed;
  vendor.approvedBy = null;
  vendor.approvedAt = null;

  await vendor.save();

  if (trimmed) {
    log.info(`[email] Vendor ${vendor.id} rejected: ${trimmed}`);
  }

  return { ok: true as const };
}

export async function promoteUserByEmailSvc(email: string, actingAdminId: number) {
  const e = String(email || '').trim();
  if (!e) return { ok: false as const, http: 400, error: 'EMAIL_REQUIRED' as const };
  if (!Number.isFinite(actingAdminId) || actingAdminId <= 0) {
    return { ok: false as const, http: 400, error: 'Bad admin id' as const };
  }

  const user = await User.findOne({ where: { email: { [Op.iLike]: e } } });
  if (!user) return { ok: false as const, http: 404, error: 'USER_NOT_FOUND' as const };

  const currentRole = String(user.role || '').toLowerCase();
  if (currentRole === 'admin') {
    return { ok: true as const, alreadyAdmin: true as const, id: Number(user.id) };
  }

  await User.update({ role: 'admin' }, { where: { id: Number(user.id) } });

  log.info(
    `[audit] User ${user.id} promoted to admin by ${actingAdminId} at ${new Date().toISOString()}`
  );

  return { ok: true as const, id: Number(user.id) };
}
