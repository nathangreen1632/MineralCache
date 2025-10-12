import type { Request, Response } from 'express';
import { Op, type Order } from 'sequelize';
import { z, type ZodError } from 'zod';
import { Product } from '../models/product.model.js';
import { ProductImage } from '../models/productImage.model.js';
import { Vendor } from '../models/vendor.model.js';
import { productSearchQuerySchema } from '../validation/search.schema.js';

/** minimal, non-deprecated zod error serializer */
function zDetails(err: ZodError) {
  const treeify = (z as any).treeifyError;
  if (typeof treeify === 'function') return treeify(err);
  return {
    issues: err.issues.map((i) => ({
      path: Array.isArray(i.path) ? i.path.join('.') : String(i.path ?? ''),
      message: i.message,
      code: i.code,
    })),
  };
}

// Public uploads mount (same default as products.controller)
const UPLOADS_PUBLIC_ROUTE = process.env.UPLOADS_PUBLIC_ROUTE ?? '/uploads';
function toPublicUrl(rel?: string | null) {
  if (!rel) return null;
  const s = String(rel).replace(/^\/+/, '');
  return `${UPLOADS_PUBLIC_ROUTE}/${s}`;
}

export async function searchProducts(req: Request, res: Response): Promise<void> {
  const parsed = productSearchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: zDetails(parsed.error) });
    return;
  }

  const {
    q,
    page: pageIn,
    pageSize: pageSizeIn,
    vendorId,
    vendorSlug,
    sort,
  } = parsed.data;

  const page = pageIn ?? 1;
  const pageSize = pageSizeIn ?? 20;

  // Tokenize query; require all terms (AND), each term can match any field (OR).
  const tokens = q.split(/\s+/).map((t) => t.trim()).filter(Boolean).slice(0, 5);
  const where: any = { archivedAt: { [Op.is]: null } };

  if (tokens.length) {
    where[Op.and] = tokens.map((t) => ({
      [Op.or]: [
        { title: { [Op.iLike]: `%${t}%` } },
        { species: { [Op.iLike]: `%${t}%` } },
        { locality: { [Op.iLike]: `%${t}%` } },
        { description: { [Op.iLike]: `%${t}%` } },
      ],
    }));
  }

  // Optional vendor scoping
  if (vendorId || vendorSlug) {
    const v = vendorId
      ? await Vendor.findByPk(vendorId, { attributes: ['id'] })
      : await Vendor.findOne({ where: { slug: vendorSlug }, attributes: ['id'] });

    if (!v) {
      res.json({ items: [], page, pageSize, total: 0, totalPages: 0 });
      return;
    }
    where.vendorId = v.id;
  }

  // Sorting (parity with products list)
  let order: Order;
  if (sort === 'price_asc') order = [['priceCents', 'ASC'], ['id', 'ASC']] as unknown as Order;
  else if (sort === 'price_desc') order = [['priceCents', 'DESC'], ['id', 'DESC']] as unknown as Order;
  else order = [['createdAt', 'DESC'], ['id', 'DESC']] as unknown as Order;

  const offset = (page - 1) * pageSize;

  try {
    const { rows, count } = await Product.findAndCountAll({
      where,
      order,
      offset,
      limit: pageSize,
      include: [
        {
          model: ProductImage,
          as: 'images',
          attributes: ['v320Path', 'v800Path', 'v1600Path', 'origPath', 'isPrimary', 'sortOrder'],
          separate: true,
          limit: 1, // return one cover image per product
          order: [
            ['isPrimary', 'DESC'],
            ['sortOrder', 'ASC'],
            ['id', 'ASC'],
          ],
        },
        // 👇 NEW: include vendor so we can surface slug/name to the client
        {
          model: Vendor,
          as: 'vendor',
          attributes: ['id', 'slug'],
        },
      ],
      // distinct not required here because images is separate:true and vendor is 1:1,
      // but harmless to add if you later expand includes that could duplicate rows.
      // distinct: true,
    });

    // Flatten primaryImageUrl + vendorSlug/vendorName so the cards can render both
    const items = rows.map((p) => {
      const j: any = p.toJSON();
      const cover = Array.isArray(j.images) && j.images[0] ? j.images[0] : null;
      const rel =
        cover?.v800Path || cover?.v320Path || cover?.v1600Path || cover?.origPath || null;
      const url = rel ? toPublicUrl(rel) : null;

      return {
        ...j,
        vendorSlug: j.vendor?.slug ?? null,
        primaryImageUrl: url,
        // If you don’t want to ship the nested objects:
        // vendor: undefined,
        // images: undefined,
      };
    });

    res.json({
      items,
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize),
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Search failed', detail: e?.message });
  }
}
