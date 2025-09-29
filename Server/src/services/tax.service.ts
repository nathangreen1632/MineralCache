const TAX_FLAG = String(process.env.TAX_ENABLED ?? '').trim().toLowerCase();
export const taxFeatureEnabled =
  TAX_FLAG === '1' || TAX_FLAG === 'true' || TAX_FLAG === 'yes' || TAX_FLAG === 'on';

/** Simple bps → cents calculator on SUBTOTAL only (shipping excluded) */
export function calcTaxCents(subtotalCents: number, taxRateBps: number): number {
  if (!taxFeatureEnabled) return 0;
  const sub = Math.max(0, Math.trunc(Number(subtotalCents) || 0));
  const bps = Math.max(0, Math.trunc(Number(taxRateBps) || 0));
  if (sub === 0 || bps === 0) return 0;
  // round to nearest cent
  return Math.round((sub * bps) / 10_000);
}
