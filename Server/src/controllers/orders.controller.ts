// Server/src/controllers/orders.controller.ts
import type { Request, Response } from 'express';

export async function listMyOrders(_req: Request, res: Response): Promise<void> {
  res.json({ items: [] });
}
export async function getOrder(_req: Request, res: Response): Promise<void> {
  res.json({ item: null });
}
export async function markShipped(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true });
}
export async function markDelivered(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true });
}
