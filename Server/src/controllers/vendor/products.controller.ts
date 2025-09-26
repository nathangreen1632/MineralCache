import type { Request, Response, NextFunction } from 'express';
import { Op, fn, col, literal, type WhereOptions } from 'sequelize';
import { Product } from '../../models/product.model.js';
import { ProductImage } from '../../models/productImage.model.js';
import { vendorListProductsSchema, vendorUpdateProductSchema } from '../../validation/vendorProducts.schema.js';

function getVendorId(req: Request): number {
  const u: any = (req as any).user ?? (req.session as any)?.user ?? null;
  const vId = Number(u?.vendorId);
  if (!Number.isFinite(vId) || vId <= 0) {
    throw Object.assign(new Error('Not a vendor'), { statusCode: 403 });
  }
  return vId;
}

function sortOrder(sort?: string) {
  switch (sort) {
    case 'oldest': return [['createdAt', 'ASC']] as any[];
    case 'price_asc': return [['priceCents', 'ASC']] as any[];
    case 'price_desc': return [['priceCents', 'DESC']] as any[];
    case 'newest':
    default:
      return [['createdAt', 'DESC']] as any[];
  }
}

/** GET /api/vendor/products */
export async function listVendorProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const vendorId = getVendorId(req);

    const parsed = vendorListProductsSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
      return;
    }
    const { page = 1, pageSize = 25, status = 'active', q, sort } = parsed.data;

    const where: WhereOptions = { vendorId };
    if (status === 'active') {
      Object.assign(where, { archivedAt: { [Op.is]: null } as any });
    } else if (status === 'archived') {
      Object.assign(where, { archivedAt: { [Op.not]: null } as any });
    }
    if (q && q.trim()) {
      Object.assign(where, { title: { [Op.iLike]: `%${q.trim()}%` } });
    }

    const offset = (page - 1) * pageSize;

    // Base fetch
    const { rows, count } = await Product.findAndCountAll({
      where,
      attributes: ['id', 'vendorId', 'title', 'priceCents', 'salePriceCents', 'onSale', 'archivedAt', 'createdAt', 'updatedAt'],
      order: sortOrder(sort),
      limit: pageSize,
      offset,
    });

    const ids = rows.map((r) => Number(r.id));
    let primaryByProduct = new Map<number, any>();
    let countsByProduct = new Map<number, number>();

    if (ids.length > 0) {
      // primary image (isPrimary=true; fallback to first by sortOrder if none)
      const primaries = await ProductImage.findAll({
        where: { productId: { [Op.in]: ids }, isPrimary: true },
        attributes: ['id', 'productId', 'isPrimary', 'sortOrder', 'url', 'sizesJson'],
        order: [['productId', 'ASC'], ['sortOrder', 'ASC'], ['id', 'ASC']],
      });
      primaryByProduct = new Map(primaries.map((p: any) => [Number(p.productId), p]));

      // if some products lack isPrimary, pick their first by sortOrder
      const missing = ids.filter((id) => !primaryByProduct.has(id));
      if (missing.length > 0) {
        const firsts = await ProductImage.findAll({
          where: { productId: { [Op.in]: missing } },
          attributes: ['id', 'productId', 'isPrimary', 'sortOrder', 'url', 'sizesJson'],
          order: [['productId', 'ASC'], ['sortOrder', 'ASC'], ['id', 'ASC']],
        });
        for (const img of firsts as any[]) {
          const pid = Number(img.productId);
          if (!primaryByProduct.has(pid)) primaryByProduct.set(pid, img);
        }
      }

      // image counts (non-deleted; ProductImage uses paranoid=true so default filter is fine)
      const counts = await ProductImage.findAll({
        where: { productId: { [Op.in]: ids } },
        attributes: ['productId', [fn('COUNT', col('id')), 'cnt']],
        group: ['productId'],
      });
      countsByProduct = new Map(counts.map((r: any) => [Number(r.productId), Number(r.get('cnt'))]));
    }

    const items = rows.map((p: any) => {
      const pid = Number(p.id);
      const primary = primaryByProduct.get(pid) ?? null;
      return {
        id: pid,
        vendorId: Number(p.vendorId),
        title: String(p.title ?? ''),
        priceCents: Number(p.priceCents ?? 0),
        salePriceCents: Number(p.salePriceCents ?? 0),
        onSale: Boolean(p.onSale),
        archivedAt: p.archivedAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        photoCount: countsByProduct.get(pid) ?? 0,
        primaryImage: primary
          ? {
            id: Number(primary.id),
            url: primary.url ?? null,
            sizes: (primary as any).sizesJson ?? null,
          }
          : null,
      };
    });

    res.json({ items, total: count, page, pageSize });
  } catch (err: any) {
    const code = Number((err as any).statusCode) || 500;
    res.status(code).json({ error: err.message || 'Failed to list vendor products' });
  }
}

/** PUT /api/vendor/products/:id */
export async function updateVendorProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const vendorId = getVendorId(req);

    const pid = Number(req.params.id);
    if (!Number.isFinite(pid) || pid <= 0) {
      res.status(400).json({ error: 'Invalid product id' });
      return;
    }

    const parsed = vendorUpdateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const product = await Product.findOne({ where: { id: pid, vendorId } });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const { onSale, archive } = parsed.data;

    const updates: any = {};
    if (typeof onSale === 'boolean') updates.onSale = onSale;
    if (typeof archive === 'boolean') {
      updates.archivedAt = archive ? new Date() : null;
    }

    if (Object.keys(updates).length === 0) {
      res.json(product); // no-op update
      return;
    }

    await product.update(updates);

    // enrich response with primary image + count
    const [primary] = await ProductImage.findAll({
      where: { productId: pid, isPrimary: true },
      attributes: ['id', 'productId', 'isPrimary', 'sortOrder', 'url', 'sizesJson'],
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
      limit: 1,
    });
    const count = await ProductImage.count({ where: { productId: pid } });

    res.json({
      id: Number(product.id),
      vendorId: Number(product.vendorId),
      title: String((product as any).title ?? ''),
      priceCents: Number((product as any).priceCents ?? 0),
      salePriceCents: Number((product as any).salePriceCents ?? 0),
      onSale: Boolean((product as any).onSale),
      archivedAt: (product as any).archivedAt,
      createdAt: (product as any).createdAt,
      updatedAt: (product as any).updatedAt,
      photoCount: count,
      primaryImage: primary
        ? {
          id: Number((primary as any).id),
          url: (primary as any).url ?? null,
          sizes: (primary as any).sizesJson ?? null,
        }
        : null,
    });
  } catch (err: any) {
    const code = Number((err as any).statusCode) || 500;
    res.status(code).json({ error: err.message || 'Failed to update product' });
  }
}
