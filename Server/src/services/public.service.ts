// Server/src/services/public.service.ts
import { Op, literal } from 'sequelize';
import { Product } from '../models/product.model.js';
import { ProductImage } from '../models/productImage.model.js';
import { UPLOADS_PUBLIC_ROUTE } from '../controllers/products.controller.js';

// ------- Helpers -------
function toPublicUrl(rel?: string | null): string | null {
  if (!rel) return null;
  const clean = String(rel).replace(/^\/+/, '');
  return `${UPLOADS_PUBLIC_ROUTE}/${encodeURI(clean)}`;
}

/**
 * ------- Featured photos: RANDOM from any photo on non-archived products -------
 * Picks random images (not just newest, not just primary). Prefers higher-res variants.
 */
export async function getFeaturedPhotosSvc(limit = 10): Promise<string[]> {
  // Clamp and sanitize limit (keep your existing 50 cap)
  const max = Math.min(Math.max(Number(limit) || 10, 1), 50);

  const imgs = await ProductImage.findAll({
    attributes: ['v1600Path', 'v800Path', 'v320Path', 'origPath'],
    include: [
      {
        model: Product,
        // NOTE: if your ProductImage.belongsTo(Product, { as: 'product' }) uses an alias,
        // add `as: 'product'` here to match it.
        attributes: [],
        required: true,
        where: { archivedAt: { [Op.is]: null } as any },
      },
    ],
    order: [literal('RANDOM()')], // Postgres; use literal('RAND()') if MySQL
    limit: max,
  });

  // Map → best available variant → public URLs → de-dupe
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const img of imgs as any[]) {
    const rel = img.v1600Path || img.v800Path || img.v320Path || img.origPath || null;
    const u = toPublicUrl(rel);
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
