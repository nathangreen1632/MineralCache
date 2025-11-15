// Server/src/jobs/payouts.job.ts
import { Op } from 'sequelize';
import { OrderVendor } from '../models/orderVendor.model.js';
import { Order } from '../models/order.model.js';
import { Vendor } from '../models/vendor.model.js';
import { createVendorTransfer } from '../services/stripe.service.js';
import { log } from '../services/log.service.js';

type RunResult = {
  vendorsProcessed: number;
  rowsUpdated: number;
  batches: Array<{
    vendorId: number;
    transferId: string | null;
    count: number;
    totalNetCents: number;
    skippedReason?: string;
  }>;
};

export async function processEligiblePayouts(): Promise<RunResult> {
  const now = new Date();
  const rows = await OrderVendor.findAll({
    where: {
      payoutStatus: 'holding',
      holdUntil: { [Op.lte]: now },
    },
    include: [
      {
        model: Order,
        as: 'order',
        where: { paidAt: { [Op.not]: null } },
        attributes: ['id', 'paidAt'],
      } as any,
    ],
    order: [
      ['vendorId', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const byVendor = new Map<number, typeof rows>();
  for (const r of rows) {
    const vid = Number(r.get('vendorId'));
    const arr = byVendor.get(vid) ?? ([] as typeof rows);
    arr.push(r);
    byVendor.set(vid, arr);
  }

  const sequelize = OrderVendor.sequelize;
  if (!sequelize) throw new Error('Sequelize not initialized');

  const batches: RunResult['batches'] = [];
  let rowsUpdated = 0;

  for (const [vendorId, group] of byVendor.entries()) {
    const totalNet = group.reduce(
      (a, r) => a + Number(r.get('vendorNetCents') ?? 0),
      0
    );

    if (totalNet <= 0) {
      batches.push({
        vendorId,
        transferId: null,
        count: group.length,
        totalNetCents: totalNet,
        skippedReason: 'non_positive_total',
      });
      continue;
    }

    const vendor = await Vendor.findByPk(vendorId);
    if (!vendor) {
      log.warn(
        `[payouts] Skipping vendor ${vendorId}: vendor record not found for ${group.length} rows`
      );
      batches.push({
        vendorId,
        transferId: null,
        count: group.length,
        totalNetCents: totalNet,
        skippedReason: 'vendor_not_found',
      });
      continue;
    }

    const stripeAccountId = (vendor as any).stripeAccountId as string | null;
    const payoutsEnabled = Boolean((vendor as any).stripePayoutsEnabled);
    if (!stripeAccountId || !payoutsEnabled) {
      log.warn(
        `[payouts] Skipping vendor ${vendorId}: Stripe account missing or payouts not enabled`
      );
      batches.push({
        vendorId,
        transferId: null,
        count: group.length,
        totalNetCents: totalNet,
        skippedReason: 'stripe_not_ready',
      });
      continue;
    }

    const transferRes = await createVendorTransfer({
      accountId: stripeAccountId,
      amountCents: totalNet,
      description: `MineralCache vendor payout vendor ${vendorId}`,
      metadata: { vendorId: String(vendorId) },
    });

    if (!transferRes.ok) {
      log.warn(
        `[payouts] Stripe transfer failed for vendor ${vendorId}: ${transferRes.error}`
      );
      batches.push({
        vendorId,
        transferId: null,
        count: group.length,
        totalNetCents: totalNet,
        skippedReason: 'stripe_transfer_failed',
      });
      continue;
    }

    const transferId = transferRes.transferId;
    const ids = group.map((r) => r.get('id'));

    await sequelize.transaction(async (t) => {
      await OrderVendor.update(
        {
          payoutStatus: 'transferred',
          transferId,
          updatedAt: new Date(),
        },
        {
          where: { id: { [Op.in]: ids } },
          transaction: t,
        }
      );
    });

    log.info(
      `[payouts] Transferred ${totalNet} cents to vendor ${vendorId} via ${transferId} for ${group.length} rows`
    );

    batches.push({
      vendorId,
      transferId,
      count: ids.length,
      totalNetCents: totalNet,
    });
    rowsUpdated += ids.length;
  }

  return { vendorsProcessed: batches.length, rowsUpdated, batches };
}

export function initializePayoutsScheduler() {
  let lastRunKey = '';
  setInterval(async () => {
    const chicagoNow = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
    );
    const yyyy = chicagoNow.getFullYear();
    const mm = String(chicagoNow.getMonth() + 1).padStart(2, '0');
    const dd = String(chicagoNow.getDate()).padStart(2, '0');
    const key = `${yyyy}-${mm}-${dd}`;
    const h = chicagoNow.getHours();
    const m = chicagoNow.getMinutes();
    const inWindow = h === 21 && m < 6;
    if (inWindow && key !== lastRunKey) {
      await processEligiblePayouts();
      lastRunKey = key;
    }
  }, 60 * 1000);
}
