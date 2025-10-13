// Server/src/controllers/public.controller.ts
import type { Request, Response } from 'express';
import { getFeaturedPhotosSvc, getOnSaleProductsSvc } from '../services/public.service.js';
import { Category } from '../models/category.model.js';
import { Product } from '../models/product.model.js';
import { ProductImage } from '../models/productImage.model.js';
import { Op, literal, where, type Order as SqlOrder } from 'sequelize';

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

export async function getFeaturedPhotosCtrl(req: Request, res: Response) {
  try {
    const rawLimit = Number(req.query.limit);
    let limit = 10;
    if (Number.isFinite(rawLimit) && rawLimit > 0) {
      limit = Math.min(rawLimit, 50);
    }
    const items = await getFeaturedPhotosSvc(limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load photos' });
  }
}

export async function getOnSaleProductsCtrl(req: Request, res: Response) {
  try {
    const rawLimit = Number(req.query.limit);
    let limit = 24;
    if (Number.isFinite(rawLimit) && rawLimit > 0) {
      limit = Math.min(rawLimit, 100);
    }
    const items = await getOnSaleProductsSvc(limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load on-sale products' });
  }
}

const UPLOADS_PUBLIC_ROUTE = process.env.UPLOADS_PUBLIC_ROUTE ?? '/uploads';
function toPublicUrl(rel?: string | null) {
  if (!rel) return null;
  const cleaned = String(rel).replace(/^\/+/, '');
  return `${UPLOADS_PUBLIC_ROUTE}/${cleaned}`;
}
const numOrNull = (v: unknown) => {
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  return null;
};

export async function listPublicProductsCtrl(req: Request, res: Response) {
  try {
    const slug = String(req.query.category || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(60, Math.max(1, Number(req.query.pageSize) || 24));
    const sort = String(req.query.sort || 'newest');

    const priceMinCentsQP = numOrNull(req.query.priceMinCents);
    const priceMaxCentsQP = numOrNull(req.query.priceMaxCents);
    const priceMinDollars = numOrNull(req.query.priceMin);
    const priceMaxDollars = numOrNull(req.query.priceMax);

    let priceMinCentsFromDollars: number | null = null;
    if (priceMinDollars != null && priceMinDollars > 0) {
      priceMinCentsFromDollars = Math.round(priceMinDollars * 100);
    }
    let priceMaxCentsFromDollars: number | null = null;
    if (priceMaxDollars != null && priceMaxDollars > 0) {
      priceMaxCentsFromDollars = Math.round(priceMaxDollars * 100);
    }

    let priceMinCents: number | null = null;
    if (priceMinCentsQP != null) priceMinCents = priceMinCentsQP;
    else priceMinCents = priceMinCentsFromDollars;

    let priceMaxCents: number | null = null;
    if (priceMaxCentsQP != null) priceMaxCents = priceMaxCentsQP;
    else priceMaxCents = priceMaxCentsFromDollars;

    const vendorId = numOrNull(req.query.vendorId);

    const onSaleParam = String(req.query.onSale ?? '').toLowerCase();
    let onSale: boolean | null = null;
    if (onSaleParam === 'true') onSale = true;
    else if (onSaleParam === 'false') onSale = false;

    const speciesParam = String(req.query.species ?? '').trim();
    const syntheticParam = String(req.query.synthetic ?? '').toLowerCase();
    let synthetic: boolean | null = null;
    if (syntheticParam === 'true') synthetic = true;
    else if (syntheticParam === 'false') synthetic = false;

    const now = new Date();
    const nowIso = now.toISOString();

    const andClauses: any[] = [{ archivedAt: { [Op.is]: null } }];
    if (vendorId) andClauses.push({ vendorId });

    if (speciesParam) {
      const parts = speciesParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length === 1) {
        andClauses.push({ species: { [Op.iLike]: parts[0] } });
      } else {
        andClauses.push({ [Op.or]: parts.map((s) => ({ species: { [Op.iLike]: s } })) });
      }
    }

    if (synthetic !== null) {
      andClauses.push({ synthetic });
    }

    if (onSale !== null) {
      const onSaleTrue = [
        { salePriceCents: { [Op.ne]: null } },
        { [Op.or]: [{ saleStartAt: null }, { saleStartAt: { [Op.lte]: now } }] },
        { [Op.or]: [{ saleEndAt: null }, { saleEndAt: { [Op.gte]: now } }] },
      ];
      if (onSale) {
        andClauses.push({ [Op.and]: onSaleTrue });
      } else {
        andClauses.push({ [Op.not]: { [Op.and]: onSaleTrue } });
      }
    }

    const effectivePrice = literal(
      `CASE WHEN "salePriceCents" IS NOT NULL AND (("saleStartAt" IS NULL OR "saleStartAt" <= TIMESTAMP '${nowIso}') AND ("saleEndAt" IS NULL OR TIMESTAMP '${nowIso}' <= "saleEndAt")) THEN "salePriceCents" ELSE "priceCents" END`
    );

    if (priceMinCents != null || priceMaxCents != null) {
      if (priceMinCents != null && priceMaxCents != null) {
        andClauses.push(where(effectivePrice, { [Op.between]: [priceMinCents, priceMaxCents] }));
      } else if (priceMinCents != null) {
        andClauses.push(where(effectivePrice, { [Op.gte]: priceMinCents }));
      } else if (priceMaxCents != null) {
        andClauses.push(where(effectivePrice, { [Op.lte]: priceMaxCents }));
      }
    }

    let order: SqlOrder;
    if (sort === 'price_asc') {
      order = [[effectivePrice, 'ASC'], ['id', 'ASC']] as unknown as SqlOrder;
    } else if (sort === 'price_desc') {
      order = [[effectivePrice, 'DESC'], ['id', 'DESC']] as unknown as SqlOrder;
    } else if (sort === 'oldest') {
      order = [['createdAt', 'ASC'], ['id', 'ASC']] as unknown as SqlOrder;
    } else {
      order = [['createdAt', 'DESC'], ['id', 'DESC']] as unknown as SqlOrder;
    }

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

    type Cover = {
      v320Path?: string | null;
      v800Path?: string | null;
      v1600Path?: string | null;
      origPath?: string | null;
    };

    const { rows, count } = await Product.findAndCountAll({
      where: { [Op.and]: andClauses },
      include,
      distinct: true,
      order,
      offset,
      limit: pageSize,
    });

    const items = rows.map((p) => {
      const j: any = p.toJSON();

      let cover: Cover | undefined = undefined;
      if (Array.isArray(j.images) && j.images.length > 0) {
        const first = j.images[0];
        if (first && typeof first === 'object') {
          cover = first as Cover;
        }
      }

      let rel: string | null = null;
      if (cover && typeof cover.v800Path === 'string' && cover.v800Path.length > 0) {
        rel = cover.v800Path;
      } else if (cover && typeof cover.v320Path === 'string' && cover.v320Path.length > 0) {
        rel = cover.v320Path;
      } else if (cover && typeof cover.v1600Path === 'string' && cover.v1600Path.length > 0) {
        rel = cover.v1600Path;
      } else if (cover && typeof cover.origPath === 'string' && cover.origPath.length > 0) {
        rel = cover.origPath;
      }

      let salePriceValue: number | null = null;
      if (j.salePriceCents != null) {
        salePriceValue = Number(j.salePriceCents);
      }

      let primaryImageUrl: string | null = null;
      if (rel) {
        primaryImageUrl = toPublicUrl(rel);
      }

      let slugValue: string | null = null;
      if (typeof j.slug === 'string' && j.slug.length > 0) {
        slugValue = j.slug;
      }

      let nameValue: string | null = null;
      if (typeof j.title === 'string' && j.title.length > 0) {
        nameValue = j.title;
      } else if (typeof j.name === 'string' && j.name.length > 0) {
        nameValue = j.name;
      }

      let priceValue = 0;
      if (j.priceCents != null) {
        priceValue = Number(j.priceCents);
      }

      let vendorIdValue: number | null = null;
      if (j.vendorId != null) {
        vendorIdValue = j.vendorId as number;
      }

      return {
        id: j.id,
        slug: slugValue,
        name: nameValue,
        title: nameValue,
        priceCents: priceValue,
        salePriceCents: salePriceValue,
        primaryImageUrl,
        vendorId: vendorIdValue,
        vendor: null as any,
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
