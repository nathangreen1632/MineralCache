// Server/src/controllers/vendor/products.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { Op, fn, col, type WhereOptions } from 'sequelize';
import { Product } from '../../models/product.model.js';
import { ProductImage } from '../../models/productImage.model.js';
import {
  listVendorProductsQuerySchema,
  updateVendorProductFlagsSchema,
  type ListVendorProductsQuery,
} from '../../validation/vendorProducts.schema.js';

function getVendorId(req: Request): number {
  const v: any = (req as any).vendor;
  const maybeVid = Number(v?.id);
  if (Number.isFinite(maybeVid) && maybeVid > 0) return maybeVid;

  const u: any = (req as any).user ?? (req.session as any)?.user ?? null;
  const fromUser = Number(u?.vendorId);
  if (Number.isFinite(fromUser) && fromUser > 0) return fromUser;

  throw Object.assign(new Error('Not a vendor'), { statusCode: 403 });
}

function sortOrder(sort?: string) {
  switch (sort) {
    case 'oldest': return [['createdAt', 'ASC']] as any[];
    case 'price_asc': return [['priceCents', 'ASC']] as any[];
    case 'price_desc': return [['priceCents', 'DESC']] as any[];
    case 'newest':
    default: return [['createdAt', 'DESC']] as any[];
  }
}

/** ---------------------------------------------
 * URL helpers for derivative images → public URLs
 * --------------------------------------------*/
function toPublicUrl(rel?: string | null): string | null {
  if (!rel) return null;
  const s = String(rel);
  if (!s) return null;
  if (s.startsWith('/')) return s;
  return `/uploads/${s.replace(/^\/+/, '')}`;
}

function pickThumbUrl(img: any): string | null {
  const p320 = toPublicUrl(img?.v320Path);
  if (p320) return p320;
  const p800 = toPublicUrl(img?.v800Path);
  if (p800) return p800;
  const p1600 = toPublicUrl(img?.v1600Path);
  if (p1600) return p1600;
  return toPublicUrl(img?.origPath);
}

/** GET /api/vendor/products */
export async function listVendorProducts(req: Request, res: Response, _next: NextFunction) {
  try {
    const vendorId = getVendorId(req);

    // validate query with schema
    const parsed = listVendorProductsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten?.() });
      return;
    }
    const { page = 1, pageSize = 25, status = 'active', q, sort } =
      parsed.data as ListVendorProductsQuery;

    // Also honor includeArchived / onlyArchived flags (even if not in the schema)
    const includeArchived =
      String(req.query.includeArchived ?? 'false').toLowerCase() === 'true' || status === 'all';
    const onlyArchived =
      String(req.query.onlyArchived ?? 'false').toLowerCase() === 'true' || status === 'archived';

    const where: WhereOptions = { vendorId };

    // Archive filter logic
    if (onlyArchived) {
      Object.assign(where, { archivedAt: { [Op.not]: null } as any });
    } else if (!includeArchived) {
      Object.assign(where, { archivedAt: { [Op.is]: null } as any });
    }
    // else: include both active + archived by not adding an archivedAt filter

    if (q && String(q).trim()) {
      Object.assign(where, { title: { [Op.iLike]: `%${String(q).trim()}%` } });
    }

    const offset = (page - 1) * pageSize;

    // Base fetch
    const { rows, count } = await Product.findAndCountAll({
      where,
      attributes: [
        'id',
        'vendorId',
        'title',
        'priceCents',
        'salePriceCents',
        'archivedAt',
        'createdAt',
        'updatedAt',
      ],
      order: sortOrder(sort),
      limit: pageSize,
      offset,
    });

    const ids = rows.map((r) => Number(r.id));
    let primaryByProduct = new Map<number, any>();
    let countsByProduct = new Map<number, number>();

    if (ids.length > 0) {
      // primary image
      const primaries = await ProductImage.findAll({
        where: { productId: { [Op.in]: ids }, isPrimary: true },
        attributes: [
          'id',
          'productId',
          'isPrimary',
          'sortOrder',
          'origPath',
          'v320Path',
          'v800Path',
          'v1600Path',
        ],
        order: [['productId', 'ASC'], ['sortOrder', 'ASC'], ['id', 'ASC']],
      });
      primaryByProduct = new Map(primaries.map((p: any) => [Number(p.productId), p]));

      const missing = ids.filter((id) => !primaryByProduct.has(id));
      if (missing.length > 0) {
        const firsts = await ProductImage.findAll({
          where: { productId: { [Op.in]: missing } },
          attributes: [
            'id',
            'productId',
            'isPrimary',
            'sortOrder',
            'origPath',
            'v320Path',
            'v800Path',
            'v1600Path',
          ],
          order: [['productId', 'ASC'], ['sortOrder', 'ASC'], ['id', 'ASC']],
        });
        for (const img of firsts as any[]) {
          const pid = Number(img.productId);
          if (!primaryByProduct.has(pid)) primaryByProduct.set(pid, img);
        }
      }

      // image counts
      const counts = await ProductImage.findAll({
        where: { productId: { [Op.in]: ids } },
        attributes: ['productId', [fn('COUNT', col('id')), 'cnt']],
        group: ['productId'],
      });
      countsByProduct = new Map(
        counts.map((r: any) => [Number(r.productId), Number(r.get('cnt'))])
      );
    }

    const items = rows.map((p: any) => {
      const pid = Number(p.id);
      const primary = primaryByProduct.get(pid) ?? null;
      const onSale = p.salePriceCents != null;

      return {
        id: pid,
        title: String(p.title ?? ''),
        priceCents: Number(p.priceCents ?? 0),
        onSale,
        archived: !!p.archivedAt, // ensure client knows archive state
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        photoCount: countsByProduct.get(pid) ?? 0,
        primaryPhotoUrl: primary ? pickThumbUrl(primary) : null,
      };
    });

    res.json({ items, total: count, page, pageSize });
  } catch (err: any) {
    const code = Number((err as any).statusCode) || 500;
    res.status(code).json({ error: err.message || 'Failed to list vendor products' });
  }
}

/** PUT /api/vendor/products/:id */
export async function updateVendorProduct(req: Request, res: Response, _next: NextFunction) {
  try {
    const vendorId = getVendorId(req);

    const pid = Number(req.params.id);
    if (!Number.isFinite(pid) || pid <= 0) {
      res.status(400).json({ error: 'Invalid product id' });
      return;
    }

    const parsed = updateVendorProductFlagsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten?.() });
      return;
    }
    const { onSale, archived } = parsed.data;

    const product = await Product.findOne({ where: { id: pid, vendorId } });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const updates: any = {};
    if (typeof onSale === 'boolean') {
      updates.salePriceCents = onSale
        ? Math.max(1, Number((product as any).salePriceCents ?? 1))
        : null;
    }
    if (typeof archived === 'boolean') {
      updates.archivedAt = archived ? new Date() : null;
    }

    if (Object.keys(updates).length === 0) {
      res.json(product);
      return;
    }

    await product.update(updates);

    const [primary] = await ProductImage.findAll({
      where: { productId: pid, isPrimary: true },
      attributes: [
        'id',
        'productId',
        'isPrimary',
        'sortOrder',
        'origPath',
        'v320Path',
        'v800Path',
        'v1600Path',
      ],
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
      limit: 1,
    });
    const count = await ProductImage.count({ where: { productId: pid } });

    res.json({
      id: Number(product.id),
      title: String((product as any).title ?? ''),
      priceCents: Number((product as any).priceCents ?? 0),
      onSale: (product as any).salePriceCents != null,
      archived: !!(product as any).archivedAt,
      createdAt: (product as any).createdAt,
      updatedAt: (product as any).updatedAt,
      photoCount: count,
      primaryPhotoUrl: primary ? pickThumbUrl(primary) : null,
    });
  } catch (err: any) {
    const code = Number((err as any).statusCode) || 500;
    res.status(code).json({ error: err.message || 'Failed to update product' });
  }
}
