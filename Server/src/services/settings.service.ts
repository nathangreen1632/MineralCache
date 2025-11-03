// Server/src/services/settings.service.ts
import { AdminSettings } from '../models/adminSettings.model.js';

/** Raw DB row (cached as-is) */
export type AdminSettingsCache = Partial<{
  id: number;
  commission_bps: number;
  min_fee_cents: number;
  stripe_enabled: boolean;
  currency: string;

  ship_flat_cents: number;
  ship_per_item_cents: number;
  ship_free_threshold_cents: number | null;
  ship_handling_cents: number | null;

  tax_rate_bps: number;
  tax_label: string | null;

  brandName: string;
  emailFrom: string;

  createdAt: string | Date;
  updatedAt: string | Date;
}>;

/** Effective settings seen by the app (DB values with ENV fallbacks + flags) */
export type EffectiveSettings = {
  commission_bps: number;
  min_fee_cents: number;
  stripe_enabled: boolean;
  currency: string;

  ship_flat_cents: number;
  ship_per_item_cents: number;
  ship_free_threshold_cents: number | null;
  ship_handling_cents: number | null;

  tax_enabled: boolean;     // feature flag from ENV
  tax_rate_bps: number;     // DB (or ENV fallback)
  tax_label: string | null; // DB (or ENV fallback)

  brandName: string;
  emailFrom: string;
};

let cached: AdminSettingsCache | null = null;
let cachedAt = 0;

/** ---------------------------------------------
 * Small helpers for ENV parsing
 * --------------------------------------------*/
function envBool(name: string, def = false): boolean {
  const raw = process.env[name];
  if (!raw) return def;
  const v = raw.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function envInt(name: string, def = 0): number {
  const raw = process.env[name];
  if (!raw) return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.trunc(n);
}

function envIntOrNull(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function envStr(name: string, def: string): string {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') return def;
  return raw;
}

/** ---------------------------------------------
 * Read AdminSettings with a tiny in-memory TTL cache.
 * Returns a plain JSON shape (partial).
 * --------------------------------------------*/
export async function getAdminSettingsCached(ttlMs = 10_000): Promise<AdminSettingsCache> {
  const now = Date.now();
  const fresh = cached && now - cachedAt < ttlMs;
  if (fresh) return cached as AdminSettingsCache;

  // Prefer singleton row id=1; fall back to first row if needed.
  const row =
    (await AdminSettings.findByPk(1).catch(() => null)) ??
    (await AdminSettings.findOne({ order: [['id', 'ASC']] }).catch(() => null));

  const json: AdminSettingsCache = row ? (row.get({ plain: true }) as AdminSettingsCache) : {};

  cached = json;
  cachedAt = now;
  return json;
}

/** Force cache refresh after writes */
export function invalidateAdminSettingsCache(): void {
  cached = null;
  cachedAt = 0;
}

/** ---------------------------------------------
 * Compute EFFECTIVE settings (DB + ENV fallbacks)
 * - Flags like TAX_ENABLED remain ENV-driven
 * - Values missing in DB fall back to ENV (then sensible defaults)
 * --------------------------------------------*/
export async function getEffectiveSettings(): Promise<EffectiveSettings> {
  const s = await getAdminSettingsCached();

  // Currency: prefer explicit DB currency, then CURRENCY, then STRIPE_CURRENCY, then 'usd'
  let currency = s.currency || '';
  if (!currency) {
    currency = envStr('CURRENCY', envStr('STRIPE_CURRENCY', 'usd')).toLowerCase();
  } else {
    currency = String(currency).toLowerCase();
  }

  // Tax is opt-in via ENV
  const taxEnabled = envBool('TAX_ENABLED', false);

  // Tax rate/label: read DB first; if missing, ENV; else defaults
  let taxRateBps = typeof s.tax_rate_bps === 'number' ? s.tax_rate_bps : NaN;
  if (!Number.isFinite(taxRateBps)) {
    taxRateBps = envInt('TAX_RATE_BPS', 0);
  }
  let taxLabel = typeof s.tax_label === 'string' || s.tax_label === null ? s.tax_label : null;
  if (taxLabel === null) {
    const envLabel = process.env.TAX_LABEL;
    if (envLabel && envLabel.trim() !== '') taxLabel = envLabel;
  }

  // Brand/email fallbacks
  const brandName = s.brandName || envStr('BRAND_NAME', 'Mineral Cache');
  const emailFrom = s.emailFrom || envStr('EMAIL_FROM', 'no-reply@mineralcache.com');

  return {
    commission_bps: typeof s.commission_bps === 'number' ? s.commission_bps : 800,
    min_fee_cents: typeof s.min_fee_cents === 'number' ? s.min_fee_cents : 75,
    stripe_enabled: typeof s.stripe_enabled === 'boolean' ? s.stripe_enabled : envBool('STRIPE_ENABLED', false),
    currency,

    ship_flat_cents: typeof s.ship_flat_cents === 'number' ? s.ship_flat_cents : envInt('SHIP_FLAT_CENTS', 0),
    ship_per_item_cents:
      typeof s.ship_per_item_cents === 'number' ? s.ship_per_item_cents : envInt('SHIP_PER_ITEM_CENTS', 0),
    ship_free_threshold_cents:
      s.ship_free_threshold_cents !== undefined ? s.ship_free_threshold_cents : envIntOrNull('SHIP_FREE_THRESHOLD_CENTS'),
    ship_handling_cents:
      s.ship_handling_cents !== undefined ? s.ship_handling_cents : envIntOrNull('SHIP_HANDLING_CENTS'),

    tax_enabled: taxEnabled,
    tax_rate_bps: taxRateBps,
    tax_label: taxLabel,

    brandName,
    emailFrom,
  };
}

/** ---------------------------------------------
 * Persist admin edits to AdminSettings (singleton row).
 * Accepts the camelCase DTO shape from your controller.
 * Returns fresh EFFECTIVE settings after save.
 * --------------------------------------------*/
export type UpdateAdminSettingsInput = Partial<{
  commissionBps: number;
  minFeeCents: number;
  stripeEnabled: boolean;
  currency: string;

  shipFlatCents: number;
  shipPerItemCents: number;
  shipFreeThresholdCents: number | null;
  shipHandlingCents: number | null;

  taxRateBps: number;
  taxLabel: string | null;

  brandName: string;
  emailFrom: string;
}>;

export async function updateAdminSettings(input: UpdateAdminSettingsInput): Promise<EffectiveSettings> {
  // Ensure singleton row exists
  let row =
    (await AdminSettings.findByPk(1).catch(() => null)) ??
    (await AdminSettings.findOne({ order: [['id', 'ASC']] }).catch(() => null));

  row ??= AdminSettings.build({id: 1} as any);

  // Commission
  if (typeof input.commissionBps === 'number') row.set('commission_bps', Math.trunc(input.commissionBps));
  if (typeof input.minFeeCents === 'number') row.set('min_fee_cents', Math.trunc(input.minFeeCents));

  // Stripe flag
  if (typeof input.stripeEnabled === 'boolean') row.set('stripe_enabled', input.stripeEnabled);

  // Currency
  if (typeof input.currency === 'string' && input.currency) row.set('currency', input.currency.toLowerCase());

  // Shipping
  if (typeof input.shipFlatCents === 'number') row.set('ship_flat_cents', Math.trunc(input.shipFlatCents));
  if (typeof input.shipPerItemCents === 'number') row.set('ship_per_item_cents', Math.trunc(input.shipPerItemCents));
  if (input.shipFreeThresholdCents === null) row.set('ship_free_threshold_cents', null);
  if (typeof input.shipFreeThresholdCents === 'number')
    row.set('ship_free_threshold_cents', Math.trunc(input.shipFreeThresholdCents));
  if (input.shipHandlingCents === null) row.set('ship_handling_cents', null);
  if (typeof input.shipHandlingCents === 'number')
    row.set('ship_handling_cents', Math.trunc(input.shipHandlingCents));

  // Tax (rate/label only; enable flag is ENV)
  if (typeof input.taxRateBps === 'number') row.set('tax_rate_bps', Math.trunc(input.taxRateBps));
  if (input.taxLabel === null) row.set('tax_label', null);
  if (typeof input.taxLabel === 'string') row.set('tax_label', input.taxLabel);

  // Branding/email
  if (typeof input.brandName === 'string' && input.brandName.trim() !== '') row.set('brandName', input.brandName.trim());
  if (typeof input.emailFrom === 'string' && input.emailFrom.trim() !== '') row.set('emailFrom', input.emailFrom.trim());

  await row.save();

  // Invalidate row cache so subsequent reads refresh
  invalidateAdminSettingsCache();

  // Return merged effective view
  return getEffectiveSettings();
}
