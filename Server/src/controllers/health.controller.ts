// Server/src/controllers/health.controller.ts
import type { Request, Response } from 'express';
export async function health(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true, ts: new Date().toISOString() });
}
