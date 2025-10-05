// Server/src/controllers/public.controller.ts
import type { Request, Response } from 'express';
import { getFeaturedPhotosSvc, getOnSaleProductsSvc } from '../services/public.service.js';

export async function getFeaturedPhotosCtrl(req: Request, res: Response) {
  try {
    // allow ?limit=... (default 10, max 50)
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 10;

    // Service already returns ONLY primary v1600 images from non-archived products
    const items = await getFeaturedPhotosSvc(limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load photos' });
  }
}

export async function getOnSaleProductsCtrl(req: Request, res: Response) {
  try {
    // allow ?limit=... (default 24, max 100)
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 24;

    const items = await getOnSaleProductsSvc(limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load on-sale products' });
  }
}
