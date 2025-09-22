// Client/src/api/cart.ts
import { get, post, put } from '../lib/api';

export type CartItem = {
  productId: number;
  title: string;
  priceCents: number;
  qty: number;
  imageUrl?: string | null;
};

export type CartTotals = {
  subtotal: number;
  shipping: number;
  total: number;
};

export type CartResponse = {
  items: CartItem[];
  totals: CartTotals;
};

export type PutCartBody = {
  items: Array<{ productId: number; qty: number }>;
};

export type CheckoutResponse =
  | { clientSecret: string }
  | { error: string };

// GET /api/cart
export function getCart() {
  return get<CartResponse>('/cart');
}

// PUT /api/cart
export function saveCart(body: PutCartBody) {
  return put<{ ok: true }, PutCartBody>('/cart', body);
}

// POST /api/cart/checkout
export function startCheckout(amountCents: number) {
  return post<CheckoutResponse, { amountCents: number }>('/cart/checkout', { amountCents });
}
