import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { OrderVendor } from '../../models/orderVendor.model.js';
import { Order } from '../../models/order.model.js';

function toDateBound(s?: string | null, end = false): Date | null {
  if (!s) return null;
  const d = new Date(String(s));
  if (!Number.isFinite(d.getTime())) return null;
  if (end) d.setHours(23, 59, 59, 999); else d.setHours(0, 0, 0, 0);
  return d;
}

export async function getMyPayouts(req: Request, res: Response): Promise<void> {
  // vendor auth — keep typing lightweight to match repo style
  const vendorId =
    Number((req as any)?.vendor?.id ?? (req as any)?.user?.vendorId ?? (req as any)?.vendorId ?? 0);
  if (!Number.isFinite(vendorId) || vendorId <= 0) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const start = toDateBound((req.query as any)?.start, false);
  const end   = toDateBound((req.query as any)?.end, true);
  const format = String((req.query as any)?.format || 'json').toLowerCase();

  const where: any = { vendorId };
  if (start && end) where.createdAt = { [Op.between]: [start, end] };
  else if (start) where.createdAt = { [Op.gte]: start };
  else if (end) where.createdAt = { [Op.lte]: end };

  const rows = await OrderVendor.findAll({
    where,
    order: [['createdAt', 'DESC']],
    include: [{ model: Order, as: 'order', required: false, attributes: ['id', 'status', 'paidAt'] } as any],
  });

  const items = rows.map((r: any) => ({
    orderId: Number(r.orderId),
    vendorId: Number(r.vendorId),
    paidAt: r.order?.paidAt ?? r.createdAt,
    grossCents: Number(r.vendorGrossCents),
    feeCents: Number(r.vendorFeeCents),
    netCents: Number(r.vendorNetCents),
  }));

  const totals = items.reduce(
    (a, x) => {
      a.gross += x.grossCents; a.fee += x.feeCents; a.net += x.netCents;
      return a;
    },
    { gross: 0, fee: 0, net: 0 }
  );

  if (format === 'csv') {
    const header = 'order_id,vendor_id,paid_at,gross_cents,fee_cents,net_cents';
    const lines = items.map(
      (x) =>
        `${x.orderId},${x.vendorId},${new Date(x.paidAt).toISOString()},${x.grossCents},${x.feeCents},${x.netCents}`
    );
    const csv = [header, ...lines, `TOTAL,,.,${totals.gross},${totals.fee},${totals.net}`].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="payouts.csv"');
    res.status(200).send(csv);
    return;
  }

  res.json({ items, totals, count: items.length });
}
