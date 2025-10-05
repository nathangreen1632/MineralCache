import type { Request, Response } from 'express';
import { getFeaturedPhotosSvc, getOnSaleProductsSvc } from '../services/public.service.js';

export async function getFeaturedPhotosCtrl(_req: Request, res: Response) {
  try {
    const items = await getFeaturedPhotosSvc(10); // up to 10
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load photos' });
  }
}

export async function getOnSaleProductsCtrl(_req: Request, res: Response) {
  try {
    const items = await getOnSaleProductsSvc(24); // change volume if you want
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load on-sale products' });
  }
}
