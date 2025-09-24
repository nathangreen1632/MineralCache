// Client/src/api/cart.ts
import { get, post, put } from '../lib/api';
import { emit } from '../lib/eventBus';
import { EV_CART_CHANGED, EV_SHIPPING_CHANGED } from '../lib/events';

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

// Optional: body for shipping rule selection
export type SetShippingRuleBody = {
  ruleId: number | string;
};

// GET /api/cart
export function getCart() {
  return get<CartResponse>('/cart');
}

// PUT /api/cart
export async function saveCart(body: PutCartBody) {
  const res = await put<{ ok: true }, PutCartBody>('/cart', body);
  if (!res.error) {
    emit(EV_CART_CHANGED);
  }
  return res;
}

// PATCH/PUT /api/cart/shipping-rule (using PUT to match existing helpers)
export async function setCartShippingRule(ruleId: number | string) {
  const res = await put<{ ok: true }, SetShippingRuleBody>('/cart/shipping-rule', { ruleId });
  if (!res.error) {
    emit(EV_SHIPPING_CHANGED, { ruleId });
  }
  return res;
}

// POST /api/cart/checkout
export function startCheckout(amountCents: number) {
  return post<CheckoutResponse, { amountCents: number }>('/cart/checkout', { amountCents });
}
