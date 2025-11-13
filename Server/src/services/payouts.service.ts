// Server/src/services/payouts.service.ts
import { Order } from '../models/order.model.js';
import { OrderItem } from '../models/orderItem.model.js';
import { OrderVendor } from '../models/orderVendor.model.js';
import { Commission } from '../config/fees.config.js';

function toInt(v: unknown) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function allocateProRataCents(lines: number[], total: number) {
  const sum = lines.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total <= 0) return lines.map(() => 0);
  const out = new Array(lines.length).fill(0);
  let used = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    const v = Math.floor((lines[i] * total) / sum);
    out[i] = v;
    used += v;
  }
  out[lines.length - 1] = total - used;
  return out;
}

export async function materializeOrderVendorMoney(orderId: number) {
  const sequelize = Order.sequelize;
  if (!sequelize) throw new Error('Sequelize not initialized');

  await sequelize.transaction(async (t) => {
    const order = await Order.findByPk(orderId, {
      attributes: ['id', 'shippingCents'],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!order) return;

    const items = await OrderItem.findAll({
      where: { orderId },
      attributes: [
        'vendorId',
        'unitPriceCents',
        'quantity',
        'lineTotalCents',
        'commissionCents',
        'commissionPct',
      ],
      transaction: t,
    });

    const byVendorSubtotal = new Map<number, number>();
    const byVendorFee = new Map<number, number>();
    let pctFromItems: number | null = null;

    for (const it of items) {
      const vid = Number((it as any).vendorId);
      if (!Number.isFinite(vid) || vid <= 0) continue;

      const lt = toInt(
        typeof (it as any).lineTotalCents === 'number'
          ? (it as any).lineTotalCents
          : toInt((it as any).unitPriceCents) * toInt((it as any).quantity)
      );
      const itemFee = toInt((it as any).commissionCents);
      const itemPct = Number((it as any).commissionPct);

      if (pctFromItems === null && Number.isFinite(itemPct)) {
        pctFromItems = itemPct;
      }

      byVendorSubtotal.set(vid, (byVendorSubtotal.get(vid) ?? 0) + lt);
      byVendorFee.set(vid, (byVendorFee.get(vid) ?? 0) + itemFee);
    }

    const pairs = Array.from(byVendorSubtotal.entries()).sort((a, b) => a[0] - b[0]);
    if (pairs.length === 0) return;

    const lines = pairs.map(([, cents]) => cents);
    const shippingTotal = toInt((order as any).shippingCents ?? 0);
    const shippingAlloc = allocateProRataCents(lines, shippingTotal);

    const pct = pctFromItems ?? Number(Commission.globalPct ?? 0);
    const minCents = toInt(Commission.minFeeCents ?? 0);

    for (let i = 0; i < pairs.length; i++) {
      const [vendorId, lineCents] = pairs[i];
      const shippingCents = shippingAlloc[i] ?? 0;
      const gross = lineCents + shippingCents;
      const fee = byVendorFee.get(vendorId) ?? 0;
      const net = gross - fee;

      await OrderVendor.findOrCreate({
        where: { orderId, vendorId },
        defaults: {
          orderId,
          vendorId,
          vendorGrossCents: gross,
          vendorFeeCents: fee,
          vendorNetCents: net,
          commissionPct: pct,
          commissionMinCents: minCents,
          payoutStatus: 'pending',
        },
        transaction: t,
      });

      await OrderVendor.update(
        {
          vendorGrossCents: gross,
          vendorFeeCents: fee,
          vendorNetCents: net,
          commissionPct: pct,
          commissionMinCents: minCents,
        },
        { where: { orderId, vendorId }, transaction: t }
      );
    }
  });
}
