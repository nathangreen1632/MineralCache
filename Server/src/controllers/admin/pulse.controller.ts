import type { Request, Response } from 'express';
import { getAdminPulseSvc, type AdminPulse } from '../../services/admin/adminPulse.service.js';

export async function getAdminPulse(_req: Request, res: Response): Promise<void> {
  try {
    const data: AdminPulse = await getAdminPulseSvc();
    res.json(data);
  } catch (e: any) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to load admin pulse', detail: message });
  }
}
