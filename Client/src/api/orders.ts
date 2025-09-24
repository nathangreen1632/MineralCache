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
