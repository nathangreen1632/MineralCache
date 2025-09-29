// Client/src/api/orders.ts
import { get } from '../lib/api';

export type OrderStatus = 'pending_payment' | 'paid' | 'failed' | 'refunded' | 'cancelled';

export type MyOrderListItem = {
  id: number;
  status: OrderStatus;
  createdAt: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  itemCount: number;
};

export type ListMyOrdersRes = {
  total: number;
  items: MyOrderListItem[];
};

export function listMyOrders(page = 1, pageSize = 20) {
  const qs = `?page=${page}&pageSize=${pageSize}`;
  return get<ListMyOrdersRes>('/orders' + qs);
}

export type OrderDetailItem = {
  productId: number;
  vendorId: number;
  title: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  primaryPhotoUrl?: string | null;
};

export type GetOrderRes = {
  item: {
    id: number;
    status: OrderStatus;
    createdAt: string;
    subtotalCents: number;
    shippingCents: number;
    totalCents: number;
    items: OrderDetailItem[];
    shippingRuleName?: string | null;
    shippingBreakdown?: Array<{ label: string; amountCents: number }>;
  };
};

export function getMyOrder(id: number) {
  return get<GetOrderRes>(`/orders/${id}`);
}

/* ==================== NEW HELPERS ==================== */

/** Admin: full refund an order. Returns { ok, refundId? } or { ok:false, error }. */
export async function adminRefundOrder(id: number) {
  const r = await fetch(`/api/admin/orders/${id}/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    return { ok: false as const, error: (body)?.error || `HTTP ${r.status}` };
  }
  const body = await r.json().catch(() => ({}));
  return { ok: true as const, refundId: (body)?.refundId ?? null };
}

/** Buyer: cancel a pending order. Returns { ok } or { ok:false, error }. */
export async function cancelMyOrder(id: number) {
  const r = await fetch(`/api/orders/${id}/cancel`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    return { ok: false as const, error: (body)?.error || `HTTP ${r.status}` };
  }
  return { ok: true as const };
}
