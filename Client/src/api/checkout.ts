// Client/src/api/checkout.ts
import { post } from '../lib/api';

export type CreateIntentRes = {
  clientSecret: string;
};

export function createCheckoutIntent() {
  // Server computes totals from the authenticated user's cart and creates an Order (pending_payment)
  return post<CreateIntentRes>('/checkout/intent', {});
}
