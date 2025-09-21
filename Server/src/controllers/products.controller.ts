// Server/src/controllers/products.controller.ts
import type { Request, Response } from 'express';

export async function listProducts(_req: Request, res: Response): Promise<void> {
  res.json({ items: [], total: 0 });
}
export async function getProduct(_req: Request, res: Response): Promise<void> {
  res.json({ item: null });
}
export async function createProduct(_req: Request, res: Response): Promise<void> {
  res.status(201).json({ id: null });
}
export async function updateProduct(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true });
}
export async function deleteProduct(_req: Request, res: Response): Promise<void> {
  res.status(204).end();
}
export async function attachImages(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true, images: [] });
}
