export const Commission = {
  globalPct: Number(process.env.GLOBAL_COMMISSION_PCT ?? 0.08), // 8%
  minFeeCents: Number(process.env.GLOBAL_MIN_FEE_CENTS ?? 75),  // $0.75
  newVendorHoldHours: Number(process.env.NEW_VENDOR_HOLD_HOURS ?? 48),
  newVendorHoldCount: Number(process.env.NEW_VENDOR_HOLD_COUNT ?? 3),
};
