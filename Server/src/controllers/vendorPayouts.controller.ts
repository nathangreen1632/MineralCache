import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { OrderVendor } from '../models/orderVendor.model.js';
import { Order } from '../models/order.model.js';

function toDateBound(s?: string | null, end = false): Date | null {
  if (!s) return null;
  const d = new Date(String(s));
  if (Number.isNaN(d.getTime())) return null;
  if (end) d.setHours(23, 59, 59, 999); else d.setHours(0, 0, 0, 0);
  return d;
}

function toCsv(rows: any[], totals: { gross: number; fee: number; net: number }) {
  const header = ['orderId','paidAt','status','vendorGrossCents','vendorFeeCents','vendorNetCents'];
  const body = rows.map(r => [
    r.orderId,
    r.paidAt ? new Date(r.paidAt).toISOString() : '',
    r.payoutStatus,
    r.vendorGrossCents,
    r.vendorFeeCents,
    r.vendorNetCents
  ].join(','));
  const totalRow = [
    'TOTALS','','',
    totals.gross,
    totals.fee,
    totals.net
  ].join(',');
  return [header.join(','), ...body, totalRow].join('\n');
}

export async function getMyPayouts(req: Request, res: Response) {
  const rawVendorId =
    (req as any)?.vendor?.id ??
    (req as any)?.user?.vendorId ??
    (req as any)?.vendorId ??
    0;
  const vendorId = Number.parseInt(String(rawVendorId), 10);
  if (!Number.isInteger(vendorId) || vendorId <= 0) {
    res.status(401).json({ ok: false, message: 'unauthorized' });
    return;
  }

  const from = toDateBound(String(req.query.from ?? ''));
  const to = toDateBound(String(req.query.to ?? ''), true);
  const wherePaid: any = {};
  if (from) wherePaid.paidAt = { [Op.gte]: from };
  if (to) wherePaid.paidAt = { ...(wherePaid.paidAt ?? {}), [Op.lte]: to };

  const rows = await OrderVendor.findAll({
    where: { vendorId },
    include: [
      {
        model: Order,
        as: 'order',
        attributes: ['id', 'paidAt'],
        where: { paidAt: { [Op.not]: null }, ...(Object.keys(wherePaid).length ? wherePaid : {}) }
      }
    ],
    order: [['id', 'DESC']]
  });

  const mapped = rows.map(r => ({
    orderId: (r as any).order?.id ?? r.get('orderId'),
    paidAt: (r as any).order?.paidAt ?? null,
    payoutStatus: r.get('payoutStatus'),
    vendorGrossCents: r.get('vendorGrossCents') ?? 0,
    vendorFeeCents: r.get('vendorFeeCents') ?? 0,
    vendorNetCents: r.get('vendorNetCents') ?? 0
  }));

  const totals = mapped.reduce(
    (a, r) => ({
      gross: a.gross + Number(r.vendorGrossCents || 0),
      fee: a.fee + Number(r.vendorFeeCents || 0),
      net: a.net + Number(r.vendorNetCents || 0)
    }),
    { gross: 0, fee: 0, net: 0 }
  );

  const format = String(req.query.format ?? 'json').toLowerCase();
  if (format === 'csv') {
    const csv = toCsv(mapped, totals);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="vendor_payouts.csv"');
    res.status(200).send(csv);
    return;
  }

  res.json({ ok: true, items: mapped, totals });
}
