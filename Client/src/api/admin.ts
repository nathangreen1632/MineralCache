// Client/src/api/admin.ts
import { get, put } from '../lib/api';

/* =========================
   ORDERS (Admin)
   ========================= */

export type AdminOrderStatus = 'pending_payment' | 'paid' | 'failed' | 'refunded';

export type AdminOrderListItem = {
  id: number;
  createdAt: string;
  status: AdminOrderStatus;
  buyerId: number;
  buyerName?: string | null;
  vendorCount?: number;
  itemCount: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
};

export function listAdminOrders(params: {
  status?: AdminOrderStatus | 'all';
  vendorId?: number;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  page?: number;
  pageSize?: number;
}) {
  const search = new URLSearchParams();
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (typeof params.vendorId === 'number') search.set('vendorId', String(params.vendorId));
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  search.set('page', String(params.page ?? 1));
  search.set('pageSize', String(params.pageSize ?? 25));
  const qs = search.toString();
  return get<{
    items: AdminOrderListItem[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>('/admin/orders' + (qs ? `?${qs}` : ''));
}

export function getAdminOrder(id: number) {
  return get<{
    item: {
      id: number;
      createdAt: string;
      status: AdminOrderStatus;
      buyerId: number;
      buyerName?: string | null;
      subtotalCents: number;
      shippingCents: number;
      totalCents: number;
      commissionCents?: number;
      commissionPct?: number;
      paymentIntentId?: string | null;
      vendors?: Array<{
        vendorId: number;
        displayName?: string | null;
        shippingCents?: number;
      }>;
      items: Array<{
        productId: number;
        vendorId: number;
        vendorName?: string | null;
        title: string;
        unitPriceCents: number;
        quantity: number;
        lineTotalCents: number;
      }>;
    };
  }>(`/admin/orders/${id}`);
}

/* =========================
   SETTINGS (Admin)
   ========================= */

export type AdminSettings = {
  commissionPct: number;       // e.g. 8
  minFeeCents: number;         // e.g. 75
  shippingDefaults: {
    baseCents: number;         // global base
    perItemCents?: number | null;
    freeThresholdCents?: number | null;
  };
  stripeEnabled?: boolean;     // read-only display in UI
};

export function getAdminSettings() {
  return get<AdminSettings>('/admin/settings');
}

export function updateAdminSettings(body: Partial<AdminSettings>) {
  // Backend allows PATCH, but our wrapper uses PUT—server can treat it as upsert/patch.
  return put<{ ok: true }, Partial<AdminSettings>>('/admin/settings', body);
}
