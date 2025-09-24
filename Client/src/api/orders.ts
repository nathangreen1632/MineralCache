// Client/src/api/orders.ts
import { get } from '../lib/api';

export type MyOrderListItem = {
  id: number;
  status: 'pending_payment' | 'paid' | 'failed' | 'refunded';
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

export function listMyOrders(page = 1, pageSize = 1) {
  const qs = `?page=${page}&pageSize=${pageSize}`;
  return get<ListMyOrdersRes>('/orders' + qs);
}

export type GetOrderRes = {
  item: {
    id: number;
    status: 'pending_payment' | 'paid' | 'failed' | 'refunded';
    subtotalCents: number;
    shippingCents: number;
    totalCents: number;
    items: Array<{
      productId: number;
      vendorId: number;
      title: string;
      unitPriceCents: number;
      quantity: number;
      lineTotalCents: number;
    }>;
  };
};
export function getMyOrder(id: number) {
  return get<GetOrderRes>(`/orders/${id}`);
}
