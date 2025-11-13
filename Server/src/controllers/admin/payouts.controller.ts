// Server/src/controllers/admin/payouts.controller.ts
import type { Request, Response } from 'express';
import { processEligiblePayouts } from '../../jobs/payouts.job.js';

export async function runPayoutsNow(req: Request, res: Response) {
  const result = await processEligiblePayouts();
  res.json({ ok: true, ...result });
}
