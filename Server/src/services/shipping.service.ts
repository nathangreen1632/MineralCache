// Server/src/services/shipping.service.ts
import { Op } from 'sequelize';
import { ShippingRule } from '../models/shippingRule.model.js';
import { AdminSettings } from '../models/adminSettings.model.js';
import { ShippingRuleTier } from '../models/shippingRuleTier.model.js';
import type { Product } from '../models/product.model.js';

export type AppliedShipping = {
  vendorId: number;
  ruleId: number | null;
  label: string;
  params: {
    baseCents: number;
    perItemCents: number;
    freeThresholdCents: number | null;
  };
  computedCents: number;
};

export type ShippingRuleSnapshot = {
  ruleId: number | null;
  source: 'vendor' | 'global' | 'admin_defaults' | 'sane_default';
  label: string;
  baseCents: number;
  perItemCents: number;
  perWeightCents: number;
  minCents: number | null;
  maxCents: number | null;
  freeThresholdCents: number | null;
};

function warnShipping(event: string, extra?: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.warn({
    ts: new Date().toISOString(),
    level: 'warn',
    area: 'shipping',
    event,
    ...(extra ?? {}),
  });
}

function saneDefaultPolicy(): ShippingRuleSnapshot {
  return {
    ruleId: null,
    source: 'sane_default',
    label: 'Default Shipping',
    baseCents: 1249,
    perItemCents: 0,
    perWeightCents: 0,
    minCents: 1249,
    maxCents: 100000,
    freeThresholdCents: null,
  };
}

export async function chooseRuleForVendor(vendorId: number): Promise<ShippingRule | null> {
  try {
    const vendorRule = await ShippingRule.findOne({
      where: { vendorId, active: true },
      order: [['priority', 'ASC'], ['id', 'ASC']],
    });
    if (vendorRule) return vendorRule;

    const globalDefault = await ShippingRule.findOne({
      where: { vendorId: { [Op.is]: null } as any, active: true, isDefaultGlobal: true },
    });
    if (globalDefault) return globalDefault;

    const anyGlobal = await ShippingRule.findOne({
      where: { vendorId: { [Op.is]: null } as any, active: true },
      order: [['priority', 'ASC'], ['id', 'ASC']],
    });
    return anyGlobal || null;
  } catch (err: any) {
    warnShipping('choose_rule.fail', { vendorId, err: String(err) });
    return null;
  }
}

async function loadAdminDefaults(): Promise<ShippingRuleSnapshot | null> {
  const settings = await AdminSettings.findOne().catch((err) => {
    warnShipping('admin_defaults.load.fail', { err: String(err) });
    return null;
  });
  if (!settings) return null;

  const anySettings = settings as any;
  const sd = anySettings.shippingDefaults || anySettings.shipping_defaults || null;
  if (!sd) return null;

  const label = typeof sd.name === 'string' && sd.name.trim() ? String(sd.name) : 'Admin Defaults';

  return {
    ruleId: null,
    source: 'admin_defaults',
    label,
    baseCents: Number(sd.baseCents ?? 0),
    perItemCents: Number(sd.perItemCents ?? 0),
    perWeightCents: Number(sd.perWeightCents ?? 0),
    minCents: typeof sd.minCents === 'number' ? sd.minCents : null,
    maxCents: typeof sd.maxCents === 'number' ? sd.maxCents : null,
    freeThresholdCents: typeof sd.freeThresholdCents === 'number' ? sd.freeThresholdCents : null,
  };
}

export async function resolveShippingPolicyForVendor(
  vendorId: number | null
): Promise<ShippingRuleSnapshot> {
  try {
    if (typeof vendorId === 'number') {
      const vendorRule = await ShippingRule.findOne({
        where: { vendorId, active: true },
        order: [['priority', 'ASC'], ['id', 'ASC']],
      });
      if (vendorRule) {
        return {
          ruleId: Number(vendorRule.id),
          source: 'vendor',
          label: String((vendorRule as any).label || 'Shipping'),
          baseCents: Number((vendorRule as any).baseCents || 0),
          perItemCents: Number((vendorRule as any).perItemCents || 0),
          perWeightCents: Number((vendorRule as any).perWeightCents || 0),
          minCents: (vendorRule as any).minCents == null ? null : Number((vendorRule as any).minCents),
          maxCents: (vendorRule as any).maxCents == null ? null : Number((vendorRule as any).maxCents),
          freeThresholdCents:
            (vendorRule as any).freeThresholdCents == null ? null : Number((vendorRule as any).freeThresholdCents),
        };
      }
    }

    const globalDefault = await ShippingRule.findOne({
      where: { vendorId: { [Op.is]: null } as any, active: true, isDefaultGlobal: true },
    });
    if (globalDefault) {
      return {
        ruleId: Number(globalDefault.id),
        source: 'global',
        label: String((globalDefault as any).label || 'Shipping'),
        baseCents: Number((globalDefault as any).baseCents || 0),
        perItemCents: Number((globalDefault as any).perItemCents || 0),
        perWeightCents: Number((globalDefault as any).perWeightCents || 0),
        minCents: (globalDefault as any).minCents == null ? null : Number((globalDefault as any).minCents),
        maxCents: (globalDefault as any).maxCents == null ? null : Number((globalDefault as any).maxCents),
        freeThresholdCents:
          (globalDefault as any).freeThresholdCents == null ? null : Number((globalDefault as any).freeThresholdCents),
      };
    }

    const anyGlobal = await ShippingRule.findOne({
      where: { vendorId: { [Op.is]: null } as any, active: true },
      order: [['priority', 'ASC'], ['id', 'ASC']],
    });
    if (anyGlobal) {
      return {
        ruleId: Number(anyGlobal.id),
        source: 'global',
        label: String((anyGlobal as any).label || 'Shipping'),
        baseCents: Number((anyGlobal as any).baseCents || 0),
        perItemCents: Number((anyGlobal as any).perItemCents || 0),
        perWeightCents: Number((anyGlobal as any).perWeightCents || 0),
        minCents: (anyGlobal as any).minCents == null ? null : Number((anyGlobal as any).minCents),
        maxCents: (anyGlobal as any).maxCents == null ? null : Number((anyGlobal as any).maxCents),
        freeThresholdCents:
          (anyGlobal as any).freeThresholdCents == null ? null : Number((anyGlobal as any).freeThresholdCents),
      };
    }
  } catch (err: any) {
    warnShipping('policy.resolve.fail', { vendorId, err: String(err) });
  }

  warnShipping('shipping.no_rule_fallback');

  const adminDefaults = await loadAdminDefaults();
  if (adminDefaults) return adminDefaults;

  return saneDefaultPolicy();
}

export async function computeVendorShipping(args: {
  vendorId: number;
  subtotalCents: number;
  itemCount: number;
}): Promise<AppliedShipping> {
  let policy: ShippingRuleSnapshot;
  try {
    policy = await resolveShippingPolicyForVendor(args.vendorId);
  } catch (err: any) {
    warnShipping('compute.simple.fail', { vendorId: args.vendorId, err: String(err) });
    policy = saneDefaultPolicy();
  }

  const base = Number(policy.baseCents || 0);
  const perItem = Number(policy.perItemCents || 0);
  const threshold = policy.freeThresholdCents == null ? null : Number(policy.freeThresholdCents);

  const qty = Math.max(0, Number(args.itemCount || 0));
  const subtotal = Math.max(0, Number(args.subtotalCents || 0));

  let cents = base + perItem * qty;

  if (threshold != null && subtotal >= threshold) {
    cents = 0;
  }

  if (typeof policy.minCents === 'number' && cents < policy.minCents) {
    cents = policy.minCents;
  }
  if (typeof policy.maxCents === 'number' && policy.maxCents > 0 && cents > policy.maxCents) {
    cents = policy.maxCents;
  }

  if (!Number.isFinite(cents) || cents < 0) {
    cents = 0;
  }

  return {
    vendorId: args.vendorId,
    ruleId: policy.ruleId,
    label: policy.label,
    params: { baseCents: base, perItemCents: perItem, freeThresholdCents: threshold },
    computedCents: Math.max(0, Math.trunc(cents)),
  };
}

async function loadActiveTiers(ruleId: number | null): Promise<{
  price: Array<{ min: number; max: number | null; amount: number }>;
  weight: Array<{ min: number; max: number | null; amount: number }>;
}> {
  if (!ruleId) return { price: [], weight: [] };
  try {
    const rows = await ShippingRuleTier.findAll({
      where: { shippingRuleId: ruleId, active: true },
      order: [['kind', 'ASC'], ['priority', 'ASC'], ['minValue', 'ASC'], ['id', 'ASC']],
    });

    const price: Array<{ min: number; max: number | null; amount: number }> = [];
    const weight: Array<{ min: number; max: number | null; amount: number }> = [];

    for (const r of rows) {
      const kind = String((r as any).kind);
      const min = Number((r as any).minValue ?? 0);
      const maxRaw = (r as any).maxValue;
      const max = maxRaw == null ? null : Number(maxRaw);
      const amount = Number((r as any).amountCents ?? 0);
      if (kind === 'price') price.push({ min, max, amount });
      else if (kind === 'weight') weight.push({ min, max, amount });
    }

    return { price, weight };
  } catch (err: any) {
    warnShipping('tiers.load.fail', { ruleId, err: String(err) });
    return { price: [], weight: [] };
  }
}

export async function computeVendorShippingByLines(opts: {
  vendorId: number | null;
  items: Array<{ product: Product; quantity: number }>;
}): Promise<{ shippingCents: number; snapshot: ShippingRuleSnapshot }> {
  let policy: ShippingRuleSnapshot;
  try {
    policy = await resolveShippingPolicyForVendor(opts.vendorId ?? null);
  } catch (err: any) {
    warnShipping('compute.lines.fail', { vendorId: opts.vendorId, err: String(err) });
    policy = saneDefaultPolicy();
  }

  let itemCount = 0;
  let totalWeightG = 0;
  let subtotalCents = 0;

  for (const line of opts.items) {
    const qty = Math.max(0, Math.trunc(Number(line.quantity ?? 0)));
    if (qty <= 0) continue;
    itemCount += qty;

    const p: any = line.product;
    const unitPriceCents =
      typeof p?.getEffectivePriceCents === 'function'
        ? Number(p.getEffectivePriceCents() ?? 0)
        : Number(p?.priceCents ?? p?.price_cents ?? 0);
    if (Number.isFinite(unitPriceCents) && unitPriceCents > 0) {
      subtotalCents += unitPriceCents * qty;
    }

    const w = Number(p?.weightG ?? p?.weight ?? 0);
    if (Number.isFinite(w) && w > 0) {
      totalWeightG += w * qty;
    }
  }

  if (policy.freeThresholdCents != null && subtotalCents >= Number(policy.freeThresholdCents)) {
    return { shippingCents: 0, snapshot: policy };
  }

  const baseCalc = (() => {
    let n = 0;
    n += Number(policy.baseCents ?? 0);
    n += Number(policy.perItemCents ?? 0) * itemCount;
    const perWeight = Number(policy.perWeightCents ?? 0);
    if (perWeight > 0 && totalWeightG > 0) {
      n += perWeight * totalWeightG;
    }
    return Math.max(0, Math.trunc(n));
  })();

  const tiers = await loadActiveTiers(policy.ruleId);
  const pickTier = (v: number, list: Array<{ min: number; max: number | null; amount: number }>) => {
    for (const t of list) {
      const meetsMin = v >= Number(t.min ?? 0);
      const underMax = t.max == null ? true : v < Number(t.max);
      if (meetsMin && underMax) return Math.max(0, Math.trunc(Number(t.amount ?? 0)));
    }
    return null;
  };

  const priceTierAmount = tiers.price.length ? pickTier(subtotalCents, tiers.price) : null;
  const weightTierAmount = tiers.weight.length ? pickTier(totalWeightG, tiers.weight) : null;

  let computed = baseCalc;
  if (priceTierAmount != null && weightTierAmount != null) {
    computed = Math.max(computed, priceTierAmount, weightTierAmount);
  } else if (priceTierAmount != null) {
    computed = Math.max(computed, priceTierAmount);
  } else if (weightTierAmount != null) {
    computed = Math.max(computed, weightTierAmount);
  }

  if (policy.minCents != null) {
    const min = Math.max(0, Math.trunc(Number(policy.minCents)));
    if (computed < min) computed = min;
  }
  if (policy.maxCents != null) {
    const max = Math.max(0, Math.trunc(Number(policy.maxCents)));
    if (computed > max) computed = max;
  }

  if (!Number.isFinite(computed) || computed < 0) {
    computed = 0;
  }

  return { shippingCents: computed, snapshot: policy };
}

export type ShipCarrier = 'usps' | 'ups' | 'fedex' | 'dhl' | 'other';
export const ALLOWED_CARRIERS: ShipCarrier[] = ['usps', 'ups', 'fedex', 'dhl', 'other'];

export function normalizeCarrier(input: unknown): ShipCarrier | null {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  if (ALLOWED_CARRIERS.includes(s as ShipCarrier)) return s as ShipCarrier;
  if (['us postal', 'usps.com', 'postal', 'mail'].includes(s)) return 'usps';
  if (['united parcel service'].includes(s)) return 'ups';
  if (['federal express', 'fed ex'].includes(s)) return 'fedex';
  return null;
}

export function trackingUrl(
  carrier: ShipCarrier | null | undefined,
  tracking: string | null | undefined
): string | null {
  const t = (tracking || '').trim();
  if (!carrier || !t) return null;
  switch (carrier) {
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(t)}`;
    case 'ups':
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(t)}`;
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(t)}`;
    case 'dhl':
      return `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${encodeURIComponent(t)}`;
    default:
      return null;
  }
}
export function carrierLabel(code?: string | null): string {
  const v = (code ?? '').toLowerCase();
  switch (v) {
    case 'ups':
      return 'UPS';
    case 'usps':
      return 'USPS';
    case 'fedex':
      return 'FedEx';
    case 'dhl':
      return 'DHL';
    default:
      return v ? v[0].toUpperCase() + v.slice(1) : '';
  }
}


