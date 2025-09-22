// Server/src/controllers/products.controller.ts
import type { Request, Response } from 'express';
import { Op, type Order } from 'sequelize';
import { z, type ZodError } from 'zod';
import { Product } from '../models/product.model.js';
import { Vendor } from '../models/vendor.model.js';
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  productIdParamSchema,
} from '../validation/product.schema.js';

/** ---------------------------------------------
 * Zod error -> minimal stable details (no deprecated APIs)
 * --------------------------------------------*/
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

/** ---------------------------------------------
 * Helpers: auth + vendor scope
 * --------------------------------------------*/
function ensureAuthed(req: Request, res: Response): req is Request & {
  user: { id: number; role: 'buyer' | 'vendor' | 'admin'; dobVerified18: boolean };
} {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  (req as any).user = u;
  return true;
}

async function requireVendor(req: Request, res: Response) {
  const u = (req as any).user as { id: number; role: string } | undefined;
  if (!u) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const vendor = await Vendor.findOne({ where: { userId: u.id } });
  if (!vendor) {
    res.status(403).json({ error: 'Vendor account required' });
    return null;
  }
  return vendor;
}

/** ---------------------------------------------
 * Vendor CRUD
 * --------------------------------------------*/
export async function createProduct(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: zDetails(parsed.error) });
    return;
  }

  const vendor = await requireVendor(req, res);
  if (!vendor) return;

  const now = new Date();
  const p = parsed.data;

  try {
    const created = await Product.create(
      {
        vendorId: Number(vendor.id),
        title: p.title,
        description: p.description ?? null,
        species: p.species,
        locality: p.locality ?? null,
        size: p.size ?? null,
        weight: p.weight ?? null,
        fluorescence: p.fluorescence ?? null,
        condition: p.condition ?? null,
        provenance: p.provenance ?? null,
        synthetic: Boolean(p.synthetic ?? false),
        onSale: Boolean(p.onSale ?? false),
        priceCents: p.priceCents,
        compareAtCents: p.compareAtCents ?? null,
        // TODO(images): attach images after upload pipeline returns references
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      } as any
    );

    res.status(201).json({ ok: true, id: Number(created.id) });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to create product', detail: e?.message });
  }
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  const idParsed = productIdParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    res.status(400).json({ error: 'Invalid product id', details: zDetails(idParsed.error) });
    return;
  }

  const bodyParsed = updateProductSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: 'Invalid input', details: zDetails(bodyParsed.error) });
    return;
  }

  const vendor = await requireVendor(req, res);
  if (!vendor) return;

  const prod = await Product.findOne({
    where: { id: idParsed.data.id, vendorId: vendor.id, archivedAt: { [Op.is]: null } as any },
  });
  if (!prod) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  try {
    const p = bodyParsed.data;
    Object.assign(prod, {
      ...(p.title !== undefined ? { title: p.title } : {}),
      ...(p.description !== undefined ? { description: p.description ?? null } : {}),
      ...(p.species !== undefined ? { species: p.species } : {}),
      ...(p.locality !== undefined ? { locality: p.locality ?? null } : {}),
      ...(p.size !== undefined ? { size: p.size ?? null } : {}),
      ...(p.weight !== undefined ? { weight: p.weight ?? null } : {}),
      ...(p.fluorescence !== undefined ? { fluorescence: p.fluorescence ?? null } : {}),
      ...(p.condition !== undefined ? { condition: p.condition ?? null } : {}),
      ...(p.provenance !== undefined ? { provenance: p.provenance ?? null } : {}),
      ...(p.synthetic !== undefined ? { synthetic: Boolean(p.synthetic) } : {}),
      ...(p.onSale !== undefined ? { onSale: Boolean(p.onSale) } : {}),
      ...(p.priceCents !== undefined ? { priceCents: p.priceCents } : {}),
      ...(p.compareAtCents !== undefined ? { compareAtCents: p.compareAtCents ?? null } : {}),
      updatedAt: new Date(),
    });

    // Sanity: compareAtCents should be >= priceCents if onSale
    if ((prod as any).onSale && (prod as any).compareAtCents != null) {
      if ((prod as any).compareAtCents < (prod as any).priceCents) {
        res.status(400).json({
          error: 'compareAtCents must be >= priceCents when onSale=true',
        });
        return;
      }
    }

    await (prod as any).save();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update product', detail: e?.message });
  }
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  // Soft-delete (archive)
  if (!ensureAuthed(req, res)) return;

  const idParsed = productIdParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    res.status(400).json({ error: 'Invalid product id', details: zDetails(idParsed.error) });
    return;
  }

  const vendor = await requireVendor(req, res);
  if (!vendor) return;

  const prod = await Product.findOne({
    where: { id: idParsed.data.id, vendorId: vendor.id, archivedAt: { [Op.is]: null } as any },
  });
  if (!prod) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  try {
    // Prefer archivedAt; if your model uses a boolean, switch this accordingly.
    // TODO(if needed): migrate to isArchived boolean flag instead of archivedAt.
    (prod as any).archivedAt = new Date();
    await (prod as any).save();
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to delete product', detail: e?.message });
  }
}

/** ---------------------------------------------
 * Public reads
 * --------------------------------------------*/
export async function getProduct(req: Request, res: Response): Promise<void> {
  const idParsed = productIdParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    res.status(400).json({ error: 'Invalid product id', details: zDetails(idParsed.error) });
    return;
  }

  try {
    const product = await Product.findOne({
      where: { id: idParsed.data.id, archivedAt: { [Op.is]: null } as any },
    });
    if (!product) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ product });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load product', detail: e?.message });
  }
}

export async function listProducts(req: Request, res: Response): Promise<void> {
  const parsed = listProductsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: zDetails(parsed.error) });
    return;
  }
  const {
    page,
    pageSize,
    vendorId,
    vendorSlug,
    species,
    synthetic,
    onSale,
    sort,
    minCents,
    maxCents,
  } = parsed.data;

  const where: any = { archivedAt: { [Op.is]: null } };

  if (species) where.species = { [Op.iLike]: species };
  if (typeof synthetic === 'boolean') where.synthetic = synthetic;
  if (typeof onSale === 'boolean') where.onSale = onSale;
  if (minCents != null || maxCents != null) {
    where.priceCents = {
      ...(minCents != null ? { [Op.gte]: minCents } : {}),
      ...(maxCents != null ? { [Op.lte]: maxCents } : {}),
    };
  }

  // Optional vendor scoping
  if (vendorId || vendorSlug) {
    const v = vendorId
      ? await Vendor.findByPk(vendorId, { attributes: ['id'] })
      : await Vendor.findOne({ where: { slug: vendorSlug }, attributes: ['id'] });

    if (!v) {
      res.json({
        items: [],
        page,
        pageSize,
        total: 0,
        totalPages: 0,
      });
      return;
    }
    where.vendorId = v.id;
  }

  const offset = (page - 1) * pageSize;

  // Build a typed Sequelize Order instead of nested ternaries
  let order: Order;
  if (sort === 'price_asc') {
    order = [['priceCents', 'ASC']];
  } else if (sort === 'price_desc') {
    order = [['priceCents', 'DESC']];
  } else {
    order = [['createdAt', 'DESC']]; // newest
  }

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
    res.status(500).json({ error: 'Failed to list products', detail: e?.message });
  }
}

/** ---------------------------------------------
 * Images attach (placeholder for Week-2)
 * --------------------------------------------*/

// One place to control the listing quota (env overridable)
const MAX_IMAGES_PER_LISTING = Number(process.env.UPLOAD_MAX_IMAGES_PER_LISTING ?? 4);

// NOTE: We now consume files from Multer (req.files). Keep TODOs for DB wiring.
export async function attachImages(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  const idParsed = productIdParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    res.status(400).json({ error: 'Invalid product id', details: zDetails(idParsed.error) });
    return;
  }

  const vendor = await requireVendor(req, res);
  if (!vendor) return;

  const prod = await Product.findOne({
    where: { id: idParsed.data.id, vendorId: vendor.id, archivedAt: { [Op.is]: null } as any },
  });
  if (!prod) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: 'No images uploaded' });
    return;
  }

  // TODO(images): query ProductImage table to get actual existing count for this product.
  // For now assume 0 so we can enforce the rule on the incoming batch.
  const existingCount = 0;

  if (existingCount + files.length > MAX_IMAGES_PER_LISTING) {
    res.status(400).json({
      error: 'Too many images for this listing',
      code: 'LISTING_IMAGE_LIMIT',
      limit: MAX_IMAGES_PER_LISTING,
      existingCount,
      attempted: files.length,
    });
    return;
  }

  // TODO(images): persist originals; generate 320/800/1600 with sharp; save records
  // For Week-2, echo basic info so frontend can continue.
  res.json({
    ok: true,
    received: files.length,
    files: files.map((f) => ({ name: f.originalname, size: f.size, type: f.mimetype })),
  });
}
