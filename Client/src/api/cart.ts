// Client/src/api/cart.ts
import { get, post, put } from '../lib/api';
import { emit } from '../lib/eventBus';
import { EV_CART_CHANGED, EV_SHIPPING_CHANGED } from '../lib/events';

export type CartItem = {
  productId: number;
  title: string;
  priceCents: number;
  // Server may return either; make both optional for compatibility
  qty?: number;
  quantity?: number;
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

// 🔧 Server expects `quantity` on PUT
export type PutCartItem = { productId: number; quantity: number };
export type PutCartBody = { items: PutCartItem[] };

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

/**
 * Add-to-cart convenience:
 * - Loads current cart
 * - Merges/inserts using `quantity`
 * - Saves via saveCart (emits EV_CART_CHANGED)
 */
export async function addToCart(productId: number, addQty = 1) {
  const res = await getCart();
  const { data, error, status } = res as {
    data: CartResponse | null;
    error?: string | null;
    status?: number;
  };

  if (status === 401) {
    return { data: null, error: 'AUTH_REQUIRED', status };
  }
  if (error) {
    return { data: null, error, status };
  }

  // Build PUT payload with `quantity`
  const items: PutCartItem[] = [];
  if (data && Array.isArray(data.items)) {
    for (const it of data.items) {
      const pid = Number(it.productId);
      const qRaw = (it.quantity ?? it.qty ?? 0);
      const qNum = Math.trunc(Number(qRaw));
      const safe = Number.isFinite(qNum) ? Math.max(0, qNum) : 0;
      items.push({ productId: pid, quantity: safe });
    }
  }

  const clamp = (n: number) => {
    const t = Math.trunc(Number(n));
    if (!Number.isFinite(t)) return 1;
    if (t < 1) return 1;
    if (t > 99) return 99;
    return t;
  };

  const idx = items.findIndex((it) => it.productId === productId);
  if (idx >= 0) {
    items[idx] = { productId, quantity: clamp(items[idx].quantity + addQty) };
  } else {
    items.push({ productId, quantity: clamp(addQty) });
  }

  return await saveCart({ items });
}
