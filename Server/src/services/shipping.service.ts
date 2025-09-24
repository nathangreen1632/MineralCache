// Server/src/services/shipping.service.ts
import { Op } from 'sequelize';
import { ShippingRule } from '../models/shippingRule.model.js';

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

/** Pick vendor-specific active rule, else global active rule (vendorId=null). */
export async function chooseRuleForVendor(vendorId: number): Promise<ShippingRule | null> {
  const [vendorRule] = await ShippingRule.findAll({
    where: { vendorId, isActive: true },
    order: [['updatedAt', 'DESC'], ['id', 'DESC']],
    limit: 1,
  });

  if (vendorRule) return vendorRule;

  const [globalRule] = await ShippingRule.findAll({
    where: { vendorId: { [Op.is]: null } as any, isActive: true },
    order: [['updatedAt', 'DESC'], ['id', 'DESC']],
    limit: 1,
  });

  return globalRule || null;
}

/** Compute shipping for a vendor group given subtotal and item count. */
export async function computeVendorShipping(args: {
  vendorId: number;
  subtotalCents: number;
  itemCount: number;
}): Promise<AppliedShipping> {
  const rule = await chooseRuleForVendor(args.vendorId);

  if (!rule) {
    return {
      vendorId: args.vendorId,
      ruleId: null,
      label: 'No rule',
      params: { baseCents: 0, perItemCents: 0, freeThresholdCents: null },
      computedCents: 0,
    };
  }

  const base = Number((rule as any).baseCents || 0);
  const perItem = Number((rule as any).perItemCents || 0);
  const threshold = (rule as any).freeThresholdCents == null ? null : Number((rule as any).freeThresholdCents);

  let cents = base + perItem * Math.max(0, Number(args.itemCount || 0));
  if (threshold != null && Number(args.subtotalCents || 0) >= threshold) {
    cents = 0;
  }

  return {
    vendorId: args.vendorId,
    ruleId: Number(rule.id),
    label: String((rule as any).label || 'Shipping'),
    params: { baseCents: base, perItemCents: perItem, freeThresholdCents: threshold },
    computedCents: Math.max(0, Math.trunc(cents)),
  };
}
