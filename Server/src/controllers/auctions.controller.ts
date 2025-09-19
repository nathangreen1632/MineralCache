// Server/src/controllers/auctions.controller.ts
import type { Request, Response } from 'express';

export async function listAuctions(_req: Request, res: Response): Promise<void> {
  res.json({ items: [], total: 0 });
}
export async function getAuction(_req: Request, res: Response): Promise<void> {
  res.json({ item: null });
}
export async function createAuction(_req: Request, res: Response): Promise<void> {
  res.status(201).json({ id: null });
}
export async function placeBid(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true });
}
export async function buyNow(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true });
}
