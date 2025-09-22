// Server/src/controllers/search.controller.ts
import type { Request, Response } from 'express';
import { Op, type Order } from 'sequelize';
import { z, type ZodError } from 'zod';
import { Product } from '../models/product.model.js';
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

  // Sorting (keep parity with products list)
  let order: Order;
  if (sort === 'price_asc') order = [['priceCents', 'ASC']];
  else if (sort === 'price_desc') order = [['priceCents', 'DESC']];
  else order = [['createdAt', 'DESC']];

  const offset = (page - 1) * pageSize;

  try {
    const { rows, count } = await Product.findAndCountAll({
      where,
      order,
      offset,
      limit: pageSize,
    });

    res.json({
      items: rows,
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize),
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Search failed', detail: e?.message });
  }
}
