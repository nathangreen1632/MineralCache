import type { Request, Response } from 'express';
import { processPendingPaymentOrders } from '../../jobs/pendingPayments.job.js';

export async function runPendingPaymentsNow(req: Request, res: Response) {
  const result = await processPendingPaymentOrders();
  res.json({ ok: true, ...result });
}
