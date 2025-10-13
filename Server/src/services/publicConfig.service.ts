// Server/src/services/publicConfig.service.ts
import {AdminSettings} from '../models/adminSettings.model.js';

export type PublicConfig = {
  commissionBps: number;
  minFeeCents: number;
  shippingDefaults: {
    baseCents: number;
    perItemCents: number;
    freeThresholdCents: number | null;
  };
};

export async function getPublicConfigSvc(): Promise<PublicConfig> {
  let commissionBps = 800;
  let minFeeCents = 75;
  let baseCents = 0;
  let perItemCents = 0;
  let freeThresholdCents: number | null = null;

  const row = await AdminSettings.findOne({ order: [['id', 'DESC']] });
  if (row) {
    commissionBps = row.getDataValue('commission_bps');

    minFeeCents = row.getDataValue('min_fee_cents');

    baseCents = row.getDataValue('ship_flat_cents');

    perItemCents = row.getDataValue('ship_per_item_cents');

    const f = row.getDataValue('ship_free_threshold_cents');
    if (typeof f === 'number') freeThresholdCents = f;
  }

  return {
    commissionBps,
    minFeeCents,
    shippingDefaults: {
      baseCents,
      perItemCents,
      freeThresholdCents,
    },
  };
}
