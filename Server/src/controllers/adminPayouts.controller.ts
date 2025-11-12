import type { Request, Response } from 'express';
import { processEligiblePayouts } from '../jobs/payouts.job.js';

export async function runPayoutsNow(req: Request, res: Response) {
  const user = (req as any)?.user ?? null;
  if (!user || String(user.role ?? '') !== 'admin') {
    res.status(403).json({ ok: false, message: 'forbidden' });
    return;
  }
  const result = await processEligiblePayouts();
  res.json({ ok: true, ...result });
}
