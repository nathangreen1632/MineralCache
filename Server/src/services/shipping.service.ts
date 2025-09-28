// Server/src/services/shipping.service.ts
import { Op } from 'sequelize';
import { ShippingRule } from '../models/shippingRule.model.js';
import { AdminSettings } from '../models/adminSettings.model.js';
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

/** Pick vendor-specific active rule, else global active default, else any active global. */
export async function chooseRuleForVendor(vendorId: number): Promise<ShippingRule | null> {
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
}

/** Load shipping defaults from AdminSettings when no rule exists. */
async function loadAdminDefaults(): Promise<ShippingRuleSnapshot | null> {
  const settings = await AdminSettings.findOne();
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

/** Resolve an active policy for a vendor with fallbacks: vendor → global default → any global → admin defaults → sane default. */
export async function resolveShippingPolicyForVendor(vendorId: number | null): Promise<ShippingRuleSnapshot> {
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
        freeThresholdCents: (vendorRule as any).freeThresholdCents == null ? null : Number((vendorRule as any).freeThresholdCents),
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
      freeThresholdCents: (globalDefault as any).freeThresholdCents == null ? null : Number((globalDefault as any).freeThresholdCents),
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
      freeThresholdCents: (anyGlobal as any).freeThresholdCents == null ? null : Number((anyGlobal as any).freeThresholdCents),
    };
  }

  // Local structured warning instead of obs.warn (since obs has no 'warn')
  // eslint-disable-next-line no-console
  console.warn({
    ts: new Date().toISOString(),
    level: 'warn',
    event: 'shipping.no_rule_fallback',
    area: 'shipping',
  });

  const adminDefaults = await loadAdminDefaults();
  if (adminDefaults) return adminDefaults;

  return {
    ruleId: null,
    source: 'sane_default',
    label: 'Default Shipping',
    baseCents: 1200,
    perItemCents: 0,
    perWeightCents: 0,
    minCents: null,
    maxCents: null,
    freeThresholdCents: null,
  };
}

/** Compute shipping for a vendor group given subtotal and item count (backward-compatible signature). */
export async function computeVendorShipping(args: {
  vendorId: number;
  subtotalCents: number;
  itemCount: number;
}): Promise<AppliedShipping> {
  const policy = await resolveShippingPolicyForVendor(args.vendorId);

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

/**
 * Optional: weight-aware computation when you have concrete line items.
 * Persists the same policy fallback logic; returns shipping cents + snapshot for order storage.
 */
export async function computeVendorShippingByLines(opts: {
  vendorId: number | null;
  items: Array<{ product: Product; quantity: number }>;
}): Promise<{ shippingCents: number; snapshot: ShippingRuleSnapshot }> {
  const policy = await resolveShippingPolicyForVendor(opts.vendorId ?? null);

  let itemCount = 0;
  let totalWeight = 0;

  for (const line of opts.items) {
    const qty = Number(line.quantity);
    if (Number.isFinite(qty) && qty > 0) {
      itemCount += qty;
      const anyProduct: any = line.product;
      const w = Number(anyProduct.weight ?? 0);
      if (Number.isFinite(w) && w > 0) {
        totalWeight += w * qty;
      }
    }
  }

  let total = policy.baseCents;

  if (policy.perItemCents > 0 && itemCount > 0) {
    total += policy.perItemCents * itemCount;
  }
  if (policy.perWeightCents > 0 && totalWeight > 0) {
    total += policy.perWeightCents * totalWeight;
  }

  if (typeof policy.minCents === 'number' && total < policy.minCents) {
    total = policy.minCents;
  }
  if (typeof policy.maxCents === 'number' && policy.maxCents > 0 && total > policy.maxCents) {
    total = policy.maxCents;
  }

  if (!Number.isFinite(total) || total < 0) {
    total = 0;
  }

  return { shippingCents: Math.trunc(total), snapshot: policy };
}
