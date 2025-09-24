import type { Request } from 'express';
import { logInfo, logError } from './log.service.js';

function base(req: Request) {
  const ctx = (req as any).context || {};
  return {
    requestId: ctx.requestId,
    userId: ctx.userId ?? null,
    method: req.method,
    path: req.path,
  };
}

export const obs = {
  checkoutIntentCreated: (req: Request, cartId: string | number, amountCents: number) =>
    logInfo('checkout.intent.created', { ...base(req), cartId, amountCents }),

  orderCreated: (req: Request, orderId: number, totals?: unknown) =>
    logInfo('order.created', { ...base(req), orderId, totals }),

  orderPaid: (req: Request, orderId: number, paymentIntentId: string) =>
    logInfo('order.paid', { ...base(req), orderId, paymentIntentId }),

  orderFailed: (req: Request, orderId: number, reason?: string) =>
    logInfo('order.failed', { ...base(req), orderId, reason }),

  stripeWebhook: (req: Request, type: string, id: string) =>
    logInfo('stripe.webhook.received', { ...base(req), eventType: type, webhookId: id }),

  error: (req: Request, event: string, err: unknown) =>
    logError(event, { ...base(req), error: (err as any)?.message || String(err) }),
};
