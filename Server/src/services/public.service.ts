// Server/src/services/public.service.ts
import { Op } from 'sequelize';
import { Product } from '../models/product.model.js';
import { ProductImage } from '../models/productImage.model.js';
import { UPLOADS_PUBLIC_ROUTE } from '../controllers/products.controller.js';

// ------- Helpers -------
function toPublicUrl(rel?: string | null): string | null {
  if (!rel) return null;
  const clean = String(rel).replace(/^\/+/, '');
  return `${UPLOADS_PUBLIC_ROUTE}/${encodeURI(clean)}`;
}

// ------- Featured photos: primary v1600 only from non-archived products -------
export async function getFeaturedPhotosSvc(limit = 10): Promise<string[]> {
  // Clamp and sanitize limit
  const max = Math.min(Math.max(Number(limit) || 10, 1), 50);

  // Get active (non-archived) product ids
  const products = await Product.findAll({
    attributes: ['id'],
    where: { archivedAt: { [Op.is]: null } as any },
    raw: true,
  });
  if (!products.length) return [];

  const activeIds = products
    .map((p: any) => Number(p.id))
    .filter((n) => Number.isFinite(n) && n > 0);

  // Pull only primary images that have a 1600 variant
  const images = await ProductImage.findAll({
    attributes: ['id', 'productId', 'isPrimary', 'v1600Path', 'updatedAt'],
    where: {
      productId: { [Op.in]: activeIds },
      isPrimary: true,
      v1600Path: { [Op.ne]: null },
    },
    order: [
      ['updatedAt', 'DESC'],
      ['id', 'DESC'],
    ],
    paranoid: true, // exclude soft-deleted
    limit: max,
  });

  // Map → public URLs → de-dupe (just in case)
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const img of images as any[]) {
    const u = toPublicUrl(img.v1600Path);
    if (u && !seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  }
  return urls;
}

// ------- On-sale products (prefer primary v1600) -------
type OnSaleItem = {
  id: number;
  slug?: string | null;
  name: string;               // from Product.title
  price: number;              // dollars
  salePrice?: number | null;  // dollars
  imageUrl?: string | null;   // primary v1600 when available
};

export async function getOnSaleProductsSvc(limit = 24): Promise<OnSaleItem[]> {
  const now = new Date();

  const rows = await Product.findAll({
    where: {
      archivedAt: { [Op.is]: null } as any,
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
        attributes: ['v1600Path', 'isPrimary'],
        paranoid: true,
      },
    ],
    order: [['updatedAt', 'DESC']],
    limit,
  });

  return rows.map((p: any) => {
    const img = Array.isArray(p.images) && p.images.length ? p.images[0] : null;
    const imageUrl = toPublicUrl(img?.v1600Path ?? null);

    return {
      id: Number(p.id),
      slug: null, // no slug column in Product model
      name: String(p.title ?? `#${p.id}`),
      price: Number(p.priceCents ?? 0) / 100,
      salePrice: p.salePriceCents != null ? Number(p.salePriceCents) / 100 : null,
      imageUrl: imageUrl ?? null,
    };
  });
}
