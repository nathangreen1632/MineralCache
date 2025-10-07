// Server/src/controllers/public.controller.ts
import type { Request, Response } from 'express';
import { getFeaturedPhotosSvc, getOnSaleProductsSvc } from '../services/public.service.js';
import { Category } from '../models/category.model.js';
import { Product } from '../models/product.model.js';
import { ProductImage } from '../models/productImage.model.js';
import { Op, literal, where, type Order as SqlOrder } from 'sequelize';

/** ---------------- Public: Categories ---------------- */
export async function listPublicCategories(_req: Request, res: Response) {
  try {
    const items = await Category.findAll({
      attributes: ['id', 'name', 'slug', 'active', 'homeOrder', 'imageKey'],
      order: [['homeOrder', 'ASC'], ['id', 'ASC']],
    });
    res.json(items);
  } catch (e: any) {
    console.error('listPublicCategories error:', e?.message || e);
    res.status(500).json({ error: 'Failed to load categories' });
  }
}

/** ---------------- Public: Featured photos ---------------- */
export async function getFeaturedPhotosCtrl(req: Request, res: Response) {
  try {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 10;
    const items = await getFeaturedPhotosSvc(limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load photos' });
  }
}

/** ---------------- Public: On-sale products ---------------- */
export async function getOnSaleProductsCtrl(req: Request, res: Response) {
  try {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 24;
    const items = await getOnSaleProductsSvc(limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load on-sale products' });
  }
}

/** ---------------- Public: Products (by category + filters) ---------------- */
const UPLOADS_PUBLIC_ROUTE = process.env.UPLOADS_PUBLIC_ROUTE ?? '/uploads';
function toPublicUrl(rel?: string | null) {
  return rel ? `${UPLOADS_PUBLIC_ROUTE}/${String(rel).replace(/^\/+/, '')}` : null;
}
const numOrNull = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function listPublicProductsCtrl(req: Request, res: Response) {
  try {
    // query params from the Category page
    const slug = String(req.query.category || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(60, Math.max(1, Number(req.query.pageSize) || 24));
    const sort = String(req.query.sort || 'newest');

    // Accept cents or dollars (client now sends cents)
    const priceMinCentsQP = numOrNull(req.query.priceMinCents);
    const priceMaxCentsQP = numOrNull(req.query.priceMaxCents);
    const priceMinDollars = numOrNull(req.query.priceMin);
    const priceMaxDollars = numOrNull(req.query.priceMax);

    const priceMinCents =
      priceMinCentsQP ?? (priceMinDollars != null && priceMinDollars > 0 ? Math.round(priceMinDollars * 100) : null);
    const priceMaxCents =
      priceMaxCentsQP ?? (priceMaxDollars != null && priceMaxDollars > 0 ? Math.round(priceMaxDollars * 100) : null);

    const vendorId = numOrNull(req.query.vendorId);
    const onSaleParam = String(req.query.onSale ?? '').toLowerCase();
    const onSale = onSaleParam === 'true' ? true : onSaleParam === 'false' ? false : null;

    const now = new Date();
    const nowIso = now.toISOString();

    const andClauses: any[] = [{ archivedAt: { [Op.is]: null } }];
    if (vendorId) andClauses.push({ vendorId });

    // on-sale filter
    if (onSale !== null) {
      const onSaleTrue = [
        { salePriceCents: { [Op.ne]: null } },
        { [Op.or]: [{ saleStartAt: null }, { saleStartAt: { [Op.lte]: now } }] },
        { [Op.or]: [{ saleEndAt: null }, { saleEndAt: { [Op.gte]: now } }] },
      ];
      andClauses.push(onSale ? { [Op.and]: onSaleTrue } : { [Op.not]: { [Op.and]: onSaleTrue } });
    }

    // effective price expression (in cents)
    const effectivePrice = literal(`CASE WHEN "salePriceCents" IS NOT NULL AND
      (("saleStartAt" IS NULL OR "saleStartAt" <= TIMESTAMP '${nowIso}')
       AND ("saleEndAt" IS NULL OR TIMESTAMP '${nowIso}' <= "saleEndAt"))
      THEN "salePriceCents" ELSE "priceCents" END`);

    if (priceMinCents != null || priceMaxCents != null) {
      if (priceMinCents != null && priceMaxCents != null) {
        andClauses.push(where(effectivePrice, { [Op.between]: [priceMinCents, priceMaxCents] }));
      } else if (priceMinCents != null) {
        andClauses.push(where(effectivePrice, { [Op.gte]: priceMinCents }));
      } else {
        andClauses.push(where(effectivePrice, { [Op.lte]: priceMaxCents! }));
      }
    }

    // sorting
    let order: SqlOrder;
    if (sort === 'price_asc') order = [[effectivePrice, 'ASC'], ['id', 'ASC']] as unknown as SqlOrder;
    else if (sort === 'price_desc') order = [[effectivePrice, 'DESC'], ['id', 'DESC']] as unknown as SqlOrder;
    else if (sort === 'oldest') order = [['createdAt', 'ASC'], ['id', 'ASC']] as unknown as SqlOrder;
    else order = [['createdAt', 'DESC'], ['id', 'DESC']] as unknown as SqlOrder;

    // includes
    const imageInclude = {
      model: ProductImage,
      as: 'images',
      attributes: ['v320Path', 'v800Path', 'v1600Path', 'origPath', 'isPrimary', 'sortOrder'],
      separate: true,
      limit: 1,
      order: [['isPrimary', 'DESC'], ['sortOrder', 'ASC'], ['id', 'ASC']],
    } as const;

    const include: any[] = [imageInclude];
    if (slug) {
      include.unshift({
        model: Category,
        as: 'categories',
        attributes: [],
        through: { attributes: [] },
        where: { slug },
        required: true,
      });
    }

    const offset = (page - 1) * pageSize;

    const { rows, count } = await Product.findAndCountAll({
      where: { [Op.and]: andClauses },
      include,
      distinct: true, // avoid overcount with belongsToMany
      order,
      offset,
      limit: pageSize,
    });

    const items = rows.map((p) => {
      const j: any = p.toJSON();
      const cover = Array.isArray(j.images) && j.images[0] ? j.images[0] : null;
      const rel =
        cover?.v800Path || cover?.v320Path || cover?.v1600Path || cover?.origPath || null;

      return {
        id: j.id,
        slug: j.slug ?? null,
        // Provide both so the client can fallback (`name ?? title`)
        name: j.title ?? j.name ?? null,
        title: j.title ?? j.name ?? null,
        priceCents: Number(j.priceCents ?? 0),
        salePriceCents: j.salePriceCents != null ? Number(j.salePriceCents) : null,
        primaryImageUrl: rel ? toPublicUrl(rel) : null,
        vendorId: j.vendorId ?? null,
        vendor: null as any, // optional; client falls back to "Vendor #<id>"
      };
    });

    res.json({
      items,
      page,
      pageSize,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / pageSize)),
    });
  } catch (e: any) {
    console.error('listPublicProductsCtrl error:', e?.message || e);
    res.status(500).json({ error: 'Failed to load products' });
  }
}
