// Server/src/services/admin/adminOrdersCsv.service.ts

export type CsvOrder = {
  id: number;
  orderNumber?: string | null;
  createdAt: Date | string;
  status: string;
  buyerUserId?: number | null;
  subtotalCents?: number | null;
  shippingCents?: number | null;
  taxCents?: number | null;
  totalCents?: number | null;
};

export type CsvItem = {
  orderId: number | string;
  vendorId?: number | null;
  vendorName?: string | null;
  quantity?: number | null;
  unitPriceCents?: number | null;
  lineTotalCents?: number | null;
};

function centsToUsd(cents: unknown): string {
  const n = Number(cents);
  const v = Number.isFinite(n) ? n : 0;
  return (v / 100).toFixed(2);
}

function escapeCsv(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (s === '') return '';
  const needsQuotes = s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r');
  if (!needsQuotes) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function readOrderNumberSafe(order: any): string | null {
  const direct = order?.orderNumber ?? order?.order_number;
  if (typeof direct === 'string' && direct.length > 0) return direct;

  if (typeof order?.get === 'function') {
    const camel = order.get('orderNumber');
    if (typeof camel === 'string' && camel.length > 0) return camel;
    const snake = order.get('order_number');
    if (typeof snake === 'string' && snake.length > 0) return snake;
  }
  return null;
}

function summarizePerVendor(items: CsvItem[]): string {
  const byVendor = new Map<number, { name?: string | null; total: number }>();

  for (const it of items) {
    const vid = Number(it.vendorId ?? 0);
    if (!Number.isFinite(vid) || vid <= 0) continue;

    const cur = byVendor.get(vid) ?? { name: it.vendorName ?? null, total: 0 };
    const add = Number(it.lineTotalCents ?? 0);
    if (Number.isFinite(add)) cur.total += add;
    if (!cur.name && it.vendorName) cur.name = it.vendorName;
    byVendor.set(vid, cur);
  }

  const parts: string[] = [];
  for (const [vid, v] of [...byVendor.entries()].sort((a, b) => a[0] - b[0])) {
    const label = v.name ? `${v.name} (${vid})` : `Vendor ${vid}`;
    parts.push(`${label}: $${centsToUsd(v.total)}`);
  }
  return parts.join(' | ');
}

export function buildAdminOrdersCsv(
  orders: CsvOrder[],
  itemsByOrderId: Map<number, CsvItem[]>,
  buyerEmailById: Map<number, string>,
): string {
  // Human-friendly headers requested
  const header = [
    'Order ID',
    'Order Number',
    'Created At',
    'Status',
    'Buyer Email',
    'Item Count',
    'Subtotal - USD',
    'Shipping - USD',
    'Tax - USD',
    'Total - USD',
    'Per-Vendor Totals',
  ].join(',');

  const lines: string[] = [header];

  for (const o of orders) {
    const orderId = Number((o as any).id);
    const items = itemsByOrderId.get(orderId) ?? [];
    let itemCount = 0;
    for (const it of items) {
      const q = Number(it.quantity ?? 0);
      if (Number.isFinite(q)) itemCount += q;
    }

    const buyerId = Number((o as any).buyerUserId ?? 0);
    const buyerEmail = Number.isFinite(buyerId) && buyerId > 0 ? buyerEmailById.get(buyerId) ?? '' : '';

    const perVendor = summarizePerVendor(items);

    const row = [
      escapeCsv(orderId),
      escapeCsv(readOrderNumberSafe(o)),
      escapeCsv(new Date((o as any).createdAt).toISOString()),
      escapeCsv((o as any).status ?? ''),
      escapeCsv(buyerEmail),
      escapeCsv(itemCount),
      escapeCsv(centsToUsd((o as any).subtotalCents)),
      escapeCsv(centsToUsd((o as any).shippingCents)),
      escapeCsv(centsToUsd((o as any).taxCents)),
      escapeCsv(centsToUsd((o as any).totalCents)),
      escapeCsv(perVendor),
    ].join(',');

    lines.push(row);
  }

  return lines.join('\n');
}
