// Server/src/services/vendor-admin.service.ts
import { Op } from 'sequelize';
import { Vendor } from '../../models/vendor.model.js';
import {
  ensureVendorStripeAccount,
  createAccountLink,
  stripeEnabled,
} from '../stripe.service.js';

export async function listVendorAppsSvc(page: number, pageSize: number) {
  const validPage = Number.isFinite(page) && page > 0 ? page : 1;
  const validSize = Number.isFinite(pageSize) && pageSize > 0 && pageSize <= 100 ? pageSize : 20;

  const { rows, count } = await Vendor.findAndCountAll({
    where: { approvalStatus: { [Op.in]: ['pending', 'rejected'] } },
    order: [['createdAt', 'DESC']],
    offset: (validPage - 1) * validSize,
    limit: validSize,
  });

  return { items: rows, total: count, page: validPage, pageSize: validSize };
}

export async function approveVendorSvc(id: number) {
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, http: 400, error: 'Bad vendor id' as const };
  }

  const vendor = await Vendor.findByPk(id);
  if (!vendor) {
    return { ok: false, http: 404, error: 'Vendor not found' as const };
  }

  vendor.approvalStatus = 'approved';
  await vendor.save();

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
    // pick whatever env you use for the public app URL; fallback is fine for dev
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

  // Email/log placeholder
  // eslint-disable-next-line no-console
  console.log(`[email] Send onboarding link to vendor ${vendor.id}: ${link.url}`);

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

  vendor.approvalStatus = 'rejected';
  await vendor.save();

  if (reason) {
    // eslint-disable-next-line no-console
    console.log(`[email] Vendor ${vendor.id} rejected: ${reason}`);
  }

  return { ok: true as const };
}
