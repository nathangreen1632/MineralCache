// Client/src/api/checkout.ts
import { post } from '../lib/api';

export type ShippingPayload = {
  name: string;
  email?: string;
  phone?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postal: string;
  country: string;
};

export type CreateIntentRes = {
  clientSecret: string;
};

export function createCheckoutIntent(shipping: ShippingPayload) {
  return post<CreateIntentRes>('/checkout/intent', { shipping });
}
