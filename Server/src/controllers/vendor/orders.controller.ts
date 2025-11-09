// Server/src/controllers/vendor/orders.controller.ts
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { db } from '../../models/sequelize.js';
import { Order } from '../../models/order.model.js';
import { OrderItem } from '../../models/orderItem.model.js';
import { User } from '../../models/user.model.js';
import {
  vendorOrderIdParamSchema,
  vendorPackingSlipQuerySchema,
} from '../../validation/vendorOrders.schema.js';
import { getEffectiveSettings } from '../../services/settings.service.js';

/**
 * GET /api/vendor/orders
 * Returns orders that contain items belonging to the current vendor.
 * Response: { items: Array<{ id, status, totalCents, createdAt, updatedAt, items: [{id,title,qty,priceCents}] }> }
 */
export async function listVendorOrders(req: Request, res: Response): Promise<void> {
  const vendorUser = (req as any).user ?? (req.session as any)?.user ?? null;
  const vendor = (req as any).vendor ?? null;

  if (!vendorUser?.id || !vendor?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // 1) Get this vendor's items (no explicit attributes -> avoid missing-column errors)
  const vendorItems = await OrderItem.findAll({
    where: { vendorId: Number(vendor.id) },
    order: [['orderId', 'DESC'], ['id', 'ASC']],
    raw: true,
  });

  if (vendorItems.length === 0) {
    res.json({ items: [] });
    return;
  }

  // 2) Load parent orders
  const orderIds = Array.from(
    new Set(vendorItems.map((i: any) => Number(i.orderId)).filter(Boolean))
  );
  const orders = await Order.findAll({
    where: { id: { [Op.in]: orderIds } },
    attributes: ['id', 'status', 'totalCents', 'createdAt', 'updatedAt'],
    raw: true,
  });

  // 3) Build result
  const orderMap = new Map<number, any>();
  for (const o of orders) {
    const id = Number((o as any).id);
    orderMap.set(id, {
      id,
      status: (o as any).status,
      totalCents: (o as any).totalCents ?? 0,
      createdAt: (o as any).createdAt,
      updatedAt: (o as any).updatedAt,
      items: [] as Array<{ id: number; title?: string | null; qty?: number | null; priceCents?: number | null }>,
    });
  }

  const readQty = (row: any) => row.quantity ?? row.qty ?? null;
  const readTitle = (row: any) =>
    row.title ?? row.itemTitle ?? row.snapshotTitle ?? row.name ?? null;
  const readPriceCents = (row: any) =>
    row.priceCents ??
    row.unitPriceCents ??
    row.linePriceCents ??
    row.unit_price_cents ??
    row.price_cents ??
    null;

  for (const it of vendorItems as any[]) {
    const oid = Number(it.orderId);
    const bucket = orderMap.get(oid);
    if (!bucket) continue;

    bucket.items.push({
      id: Number(it.id),
      orderItemId: Number(it.id),
      orderId: Number(it.orderId),
      productId: Number(it.productId),
      vendorId: Number(it.vendorId),
      title: readTitle(it),
      qty: readQty(it),
      priceCents: readPriceCents(it),
      unitPriceCents: Number(it.unitPriceCents ?? it.unit_price_cents ?? 0),
      lineTotalCents: Number(it.lineTotalCents ?? it.line_total_cents ?? 0),
      shipCarrier: it.shipCarrier ?? it.ship_carrier ?? null,
      shipTracking: it.shipTracking ?? it.ship_tracking ?? null,
      shippedAt: it.shippedAt ?? it.shipped_at ?? null,
      deliveredAt: it.deliveredAt ?? it.delivered_at ?? null,
    });
  }

  res.json({ items: Array.from(orderMap.values()) });
}

/* ----------------------------- Packing Slip ----------------------------- */

// Helper: safe parse comma separated ids
function parseItemIds(raw?: string): number[] | null {
  if (!raw) return null;
  const parts = raw
    .split(',')
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
  if (parts.length === 0) return null;
  return Array.from(new Set(parts));
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Build a simple printable HTML (no external CSS)
function renderPackingSlipHTML(opts: {
  brandName: string;
  order: Order;
  buyer: User | null;
  items: Array<{
    id: number;
    title: string;
    sku?: string | null;
    qty: number;
    notes?: string | null;
  }>;
  vendorName: string;
  shipToBlock?: string | null;
}): string {
  const { brandName, order, buyer, items, vendorName, shipToBlock } = opts;

  const lines = items
    .map(
      (it, idx) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${idx + 1}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;"><strong>${escapeHtml(
        it.title
      )}</strong>${it.sku ? `<div style="color:#6b7280;">SKU: ${escapeHtml(it.sku)}</div>` : ''}</td>
        <td style="padding:8px;text-align:center;border-bottom:1px solid #e5e7eb;">${it.qty}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#374151;">${escapeHtml(
        it.notes ?? ''
      )}</td>
      </tr>`
    )
    .join('');

  // Prefer a preformatted shippingAddressText if present; fallback to individual fields
  let shipToHtml: string;
  if (shipToBlock && shipToBlock.trim() !== '') {
    shipToHtml = `<pre style="margin:0;white-space:pre-wrap">${escapeHtml(shipToBlock)}</pre>`;
  } else {
    const shipToName = escapeHtml((order as any).shipName ?? buyer?.email ?? 'Unknown');
    const addr1 = escapeHtml((order as any).shipAddress1 ?? '');
    const addr2 = escapeHtml((order as any).shipAddress2 ?? '');
    const city = escapeHtml((order as any).shipCity ?? '');
    const state = escapeHtml((order as any).shipState ?? '');
    const postal = escapeHtml((order as any).shipPostal ?? '');
    const country = escapeHtml((order as any).shipCountry ?? 'USA');
    shipToHtml = [
      shipToName && `<div>${shipToName}</div>`,
      addr1 && `<div>${addr1}</div>`,
      addr2 && `<div>${addr2}</div>`,
      `<div>${city}${city && (state || postal) ? ', ' : ''}${state} ${postal}</div>`,
      `<div>${country}</div>`,
    ]
      .filter(Boolean)
      .join('');
  }

  const when = order.createdAt ? new Date(order.createdAt) : new Date();
  const orderDate = when.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

  return `<!doctype html>
<html lang="en-US">
<head>
<meta charset="utf-8" />
<title>Packing Slip • Order #${order.id} • ${brandName}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @media print { .no-print { display: none !important; } }
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; color:#111827; }
</style>
</head>
<body style="margin:24px;">
  <div class="no-print" style="display:flex;gap:12px;margin-bottom:16px;">
    <button onclick="window.print()" style="padding:8px 12px;border-radius:12px;border:1px solid #e5e7eb;background:#111827;color:#fff;cursor:pointer;">Print</button>
    <button onclick="window.close()" style="padding:8px 12px;border-radius:12px;border:1px solid #e5e7eb;background:#fff;color:#111827;cursor:pointer;">Close</button>
  </div>

  <header style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
    <div>
      <div style="font-size:20px;font-weight:700;">${escapeHtml(brandName)}</div>
      <div style="color:#6b7280;">Packing Slip (Vendor: ${escapeHtml(vendorName)})</div>
    </div>
    <div style="text-align:right;">
      <div style="font-weight:600;">Order #${order.id}</div>
      <div style="color:#6b7280;">${orderDate}</div>
    </div>
  </header>

  <section style="display:flex;gap:32px;margin:16px 0 24px 0;">
    <div style="min-width:280px;">
      <div style="font-weight:600;margin-bottom:6px;">Ship To</div>
      ${shipToHtml}
    </div>
    <div>
      <div style="font-weight:600;margin-bottom:6px;">Notes</div>
      <div style="color:#374151;">Pack items carefully. Do not include prices.</div>
    </div>
  </section>

  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="background:#f9fafb;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
        <th style="text-align:left;padding:8px;">#</th>
        <th style="text-align:left;padding:8px;">Item</th>
        <th style="text-align:center;padding:8px;">Qty</th>
        <th style="text-align:left;padding:8px;">Notes</th>
      </tr>
    </thead>
    <tbody>
      ${lines}
    </tbody>
  </table>

  <footer style="margin-top:24px;color:#6b7280;font-size:12px;">
    Generated by MineralCache • Do not include pricing in the box.
  </footer>
</body>
</html>`;
}

/**
 * GET /api/vendor/orders/:id/packing-slip
 * Produces a per-vendor packing slip for a given order.
 * Requires: requireVendor middleware; shows only this vendor's line items.
 * Optional: ?itemIds=1,2,3 to print a partial slip.
 */
export async function getPackingSlipHtml(req: Request, res: Response): Promise<void> {
  // Auth: requireVendor middleware attaches req.vendor
  const vendor = (req as any).vendor ?? null;
  const vendorId = Number(vendor?.id ?? 0);
  if (!vendorId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Params
  const p = vendorOrderIdParamSchema.safeParse(req.params);
  if (!p.success) {
    res.status(400).json({ error: 'Invalid order id' });
    return;
  }
  const orderId = p.data.id;

  // Query
  const q = vendorPackingSlipQuerySchema.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: 'Invalid query' });
    return;
  }
  const selectedItemIds = parseItemIds(q.data.itemIds);

  // DB sanity (for environments where db may be optional)
  const sequelize = db.instance?.();
  if (!sequelize) {
    res.status(500).json({ error: 'Database not configured' });
    return;
  }

  // Fetch order and buyer
  const order = await Order.findByPk(orderId);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  // Only items belonging to this vendor (optionally restricted to selected ids)
  const where: any = { orderId, vendorId };
  if (selectedItemIds) where.id = { [Op.in]: selectedItemIds };

  const items = await OrderItem.findAll({ where, order: [['id', 'ASC']] });
  if (items.length === 0) {
    res.status(403).json({
      error: 'No items on this order belong to your vendor or none matched selected itemIds',
    });
    return;
  }

  const buyer = await User.findByPk((order as any).buyerUserId).catch(() => null);
  const settings = await getEffectiveSettings();

  const shipToBlock =
    (order as any).shippingAddressText ??
    (order as any).shippingAddress ??
    (order as any).shipping_address ??
    null;

  const html = renderPackingSlipHTML({
    brandName: settings.brandName ?? 'Mineral Cache',
    order,
    buyer,
    vendorName:
      (vendor as any)?.displayName ??
      (vendor as any)?.name ??
      `Vendor #${vendorId}`,
    shipToBlock,
    items: items.map((i) => ({
      id: Number((i as any).id),
      title: String((i as any).title ?? (i as any).productTitle ?? `Item #${(i as any).id}`),
      sku: (i as any).sku ?? (i as any).productSku ?? null,
      qty: Number((i as any).quantity ?? 1),
      notes: (i as any).notes ?? null,
    })),
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}
