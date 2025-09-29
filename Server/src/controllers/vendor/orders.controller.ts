// Server/src/controllers/vendor/orders.controller.ts
import type { Request, Response } from 'express';
import { Order } from '../../models/order.model.js';
import { OrderItem } from '../../models/orderItem.model.js';
import { User } from '../../models/user.model.js';
import {Op} from "sequelize";

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
    raw: true, // return plain objects
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

  // Helper to read possible column variants safely
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
      title: readTitle(it),
      qty: readQty(it),
      priceCents: readPriceCents(it),
    });
  }

  res.json({ items: Array.from(orderMap.values()) });
}

/**
 * GET /api/vendor/orders/:id/pack
 * Produces a per-vendor packing slip for a given order.
 * Requires: req.user is a vendor; shows only this vendor's line items.
 */
export async function getVendorPackingSlipHtml(req: Request, res: Response): Promise<void> {
  const vendorUser = (req as any).user ?? (req.session as any)?.user ?? null;
  const vendor = (req as any).vendor ?? null; // if your middleware attaches the vendor entity
  if (!vendorUser?.id || !vendor?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const orderId = Number((req.params as any)?.id);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    res.status(400).json({ error: 'Bad id' });
    return;
  }

  const order = await Order.findByPk(orderId);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  // Only items belonging to this vendor
  const items = await OrderItem.findAll({
    where: { orderId, vendorId: Number(vendor.id) },
    order: [['id', 'ASC']],
  });

  if (items.length === 0) {
    res.status(403).json({ error: 'No items in this order belong to your vendor' });
    return;
  }

  // Optional context for header
  const buyer = await User.findByPk((order as any).buyerUserId).catch(() => null);
  const buyerName =
    (buyer as any)?.fullName ||
    (typeof buyer?.get === 'function' ? buyer.get('fullName') : null) ||
    (buyer?.email ? String(buyer.email) : 'Buyer');

  const orderNumber =
    (order as any)?.orderNumber ??
    (typeof (order as any)?.get === 'function' ? (order as any).get('orderNumber') : undefined) ??
    (typeof (order as any)?.get === 'function' ? (order as any).get('order_number') : undefined) ??
    null;

  const rows = items
    .map((i) => {
      const qty = (i as any).quantity ?? (i as any).qty ?? '';
      return `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #eee">${(i as any).title ?? ''}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:center">${qty}</td>
          <td style="padding:10px;border-bottom:1px solid #eee">${(i as any).shipCarrier ?? ''}</td>
          <td style="padding:10px;border-bottom:1px solid #eee">${(i as any).shipTracking ?? ''}</td>
        </tr>
      `;
    })
    .join('');

  const headerOrder = orderNumber ? `Order #${orderNumber}` : `Order ID ${order.id}`;
  const vendorName =
    (vendor as any)?.name ??
    (typeof vendor?.get === 'function' ? vendor.get('name') : undefined) ??
    `Vendor ${vendor.id}`;

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Packing Slip — ${headerOrder} — ${vendorName}</title>
        <style>
          @media print { .no-print { display: none; } }
          body { font-family: system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; line-height: 1.4; }
          .card { max-width: 960px; margin: 24px auto; padding: 24px; border: 1px solid #ddd; border-radius: 12px; }
          h1, h2, h3 { margin: 0 0 8px 0; }
          .muted { opacity: 0.7; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; padding: 10px; border-bottom: 1px solid #ccc; }
        </style>
      </head>
      <body>
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px">
            <div>
              <h1>Packing Slip</h1>
              <div class="muted">${headerOrder}</div>
              <div class="muted">For vendor: <strong>${vendorName}</strong></div>
              <div class="muted">Buyer: ${buyerName || ''}</div>
              <div class="muted">Date: ${new Date(order.createdAt).toLocaleString()}</div>
            </div>
            <button class="no-print" onclick="window.print()" style="padding:8px 12px;border:1px solid #ccc;border-radius:8px;background:#fafafa;cursor:pointer">Print</button>
          </div>

          <div style="margin-top:16px">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Carrier</th>
                  <th>Tracking</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      </body>
    </html>
  `;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}
