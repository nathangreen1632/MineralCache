// Server/src/services/public.service.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { Op } from 'sequelize';
import { Product } from '../models/product.model.js';
import { ProductImage } from '../models/productImage.model.js';
import {
  UPLOADS_DIR,
  UPLOADS_PUBLIC_ROUTE,
} from '../controllers/products.controller.js';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

// ------- Featured photos (from /uploads, recursive, newest first) -------
async function walkUploads(dir: string, out: Array<{ rel: string; mtime: number }>) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walkUploads(abs, out);
      continue;
    }
    const ext = path.extname(e.name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;

    try {
      const st = await fs.stat(abs);
      const rel = path.posix.join(...path.relative(UPLOADS_DIR.current, abs).split(path.sep));
      out.push({ rel, mtime: st.mtimeMs });
    } catch {
      // ignore unreadable files
    }
  }
}

export async function getFeaturedPhotosSvc(limit = 10): Promise<string[]> {
  try {
    const items: Array<{ rel: string; mtime: number }> = [];
    await walkUploads(UPLOADS_DIR.current, items);

    items.sort((a, b) => b.mtime - a.mtime);
    const top = items.slice(0, Math.min(limit, 10));
    return top.map(({ rel }) => `${UPLOADS_PUBLIC_ROUTE}/${encodeURI(rel)}`);
  } catch {
    return [];
  }
}

// ------- On-sale products (salePriceCents + active within window; not archived) -------
type OnSaleItem = {
  id: number;
  slug?: string | null;
  name: string;            // from Product.title
  price: number;           // dollars
  salePrice?: number | null; // dollars
  imageUrl?: string | null;
};

export async function getOnSaleProductsSvc(limit = 24): Promise<OnSaleItem[]> {
  const now = new Date();

  const rows = await Product.findAll({
    where: {
      archivedAt: null,
      [Op.and]: [
        { salePriceCents: { [Op.not]: null } },
        { [Op.or]: [{ saleStartAt: { [Op.is]: null } }, { saleStartAt: { [Op.lte]: now } }] },
        { [Op.or]: [{ saleEndAt: { [Op.is]: null } }, { saleEndAt: { [Op.gte]: now } }] },
      ],
    },
    include: [
      {
        model: ProductImage,
        as: 'images',
        required: false,
        where: { isPrimary: true },
        attributes: ['v800Path', 'v1600Path', 'v320Path', 'origPath', 'isPrimary'],
        // We only need the primary image; Sequelize doesn’t support limit on included hasMany reliably,
        // but isPrimary=true makes it at most one row due to your unique partial index.
      },
    ],
    order: [['updatedAt', 'DESC']],
    limit,
  });

  return rows.map((p: any) => {
    const img = Array.isArray(p.images) && p.images.length ? p.images[0] : null;
    const rel = img?.v800Path || img?.v1600Path || img?.v320Path || img?.origPath || null;
    const imageUrl = rel ? `${UPLOADS_PUBLIC_ROUTE}/${encodeURI(rel)}` : null;

    return {
      id: Number(p.id),
      slug: null, // no slug column in your Product model
      name: String(p.title ?? `#${p.id}`),
      price: Number(p.priceCents ?? 0) / 100,
      salePrice: p.salePriceCents != null ? Number(p.salePriceCents) / 100 : null,
      imageUrl,
    };
  });
}
