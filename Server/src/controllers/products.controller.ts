// Server/src/controllers/products.controller.ts
import type { Request, Response } from 'express';
import { db } from '../models/sequelize.js';
import { Op, col, fn, literal, where, type Order, type Transaction } from 'sequelize';
import { z, type ZodError } from 'zod';
import { Product } from '../models/product.model.js';
import { Vendor } from '../models/vendor.model.js';
import { ProductImage } from '../models/productImage.model.js';
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  productIdParamSchema,
} from '../validation/product.schema.js';
import {
  productIdParam as productImageProductIdParam,
  imageIdParam,
  reorderImagesSchema,
} from '../validation/productImage.schema.js';

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

// Helper: vendor ownership for a specific product
async function assertVendorOwnsProduct(
  productId: number,
  userId: number,
  role: string
): Promise<boolean> {
  if (role === 'admin') return true;
  if (role !== 'vendor') return false;
  const p = await Product.findOne({ where: { id: productId }, attributes: ['id', 'vendorId'] });
  return !!p && Number((p as any).vendorId) === Number(userId);
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
        synthetic: Boolean(p.synthetic ?? false),

        // dimensions + weight
        lengthCm: p.lengthCm ?? null,
        widthCm: p.widthCm ?? null,
        heightCm: p.heightCm ?? null,
        sizeNote: p.sizeNote ?? null,
        weightG: p.weightG ?? null,
        weightCt: p.weightCt ?? null,

        // fluorescence (structured)
        fluorescenceMode: p.fluorescence.mode,
        fluorescenceColorNote: p.fluorescence.colorNote ?? null,
        fluorescenceWavelengthNm: p.fluorescence.wavelengthNm ?? null,

        // condition + provenance
        condition: p.condition ?? null,
        conditionNote: p.conditionNote ?? null,
        provenanceNote: p.provenanceNote ?? null,
        provenanceTrail: p.provenanceTrail ?? null,

        // pricing (scheduled sale model)
        priceCents: p.priceCents,
        salePriceCents: p.salePriceCents ?? null,
        saleStartAt: p.saleStartAt ?? null,
        saleEndAt: p.saleEndAt ?? null,

        // images TODO: attach when uploader saves records

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
    const p: any = bodyParsed.data;
    const patch: any = {};

    if (p.title !== undefined) patch.title = p.title;
    if (p.description !== undefined) patch.description = p.description ?? null;

    if (p.species !== undefined) patch.species = p.species;
    if (p.locality !== undefined) patch.locality = p.locality ?? null;
    if (p.synthetic !== undefined) patch.synthetic = Boolean(p.synthetic);

    // dimensions + weight
    if (p.lengthCm !== undefined) patch.lengthCm = p.lengthCm ?? null;
    if (p.widthCm !== undefined) patch.widthCm = p.widthCm ?? null;
    if (p.heightCm !== undefined) patch.heightCm = p.heightCm ?? null;
    if (p.sizeNote !== undefined) patch.sizeNote = p.sizeNote ?? null;

    if (p.weightG !== undefined) patch.weightG = p.weightG ?? null;
    if (p.weightCt !== undefined) patch.weightCt = p.weightCt ?? null;

    // fluorescence (structured) — update granularly if provided
    if (p.fluorescence !== undefined) {
      if (Object.hasOwn(p.fluorescence, 'mode')) {
        patch.fluorescenceMode = p.fluorescence.mode;
      }
      if (Object.hasOwn(p.fluorescence, 'colorNote')) {
        patch.fluorescenceColorNote = p.fluorescence.colorNote ?? null;
      }
      if (Object.hasOwn(p.fluorescence, 'wavelengthNm')) {
        patch.fluorescenceWavelengthNm = p.fluorescence.wavelengthNm ?? null;
      }
    }

    // condition + provenance
    if (p.condition !== undefined) patch.condition = p.condition ?? null;
    if (p.conditionNote !== undefined) patch.conditionNote = p.conditionNote ?? null;

    if (p.provenanceNote !== undefined) patch.provenanceNote = p.provenanceNote ?? null;
    if (p.provenanceTrail !== undefined) patch.provenanceTrail = p.provenanceTrail ?? null;

    // pricing
    if (p.priceCents !== undefined) patch.priceCents = p.priceCents;
    if (p.salePriceCents !== undefined) patch.salePriceCents = p.salePriceCents ?? null;
    if (p.saleStartAt !== undefined) patch.saleStartAt = p.saleStartAt ?? null;
    if (p.saleEndAt !== undefined) patch.saleEndAt = p.saleEndAt ?? null;

    // compute invariants for pricing (apply to next values)
    const nextPrice =
      patch.priceCents !== undefined ? Number(patch.priceCents) : Number((prod as any).priceCents);
    const nextSale =
      patch.salePriceCents !== undefined
        ? (patch.salePriceCents as number | null)
        : ((prod as any).salePriceCents as number | null);

    if (nextSale != null && nextSale >= nextPrice) {
      res.status(400).json({ error: 'salePriceCents must be less than priceCents' });
      return;
    }

    const nextStart =
      patch.saleStartAt !== undefined ? patch.saleStartAt : (prod as any).saleStartAt;
    const nextEnd =
      patch.saleEndAt !== undefined ? patch.saleEndAt : (prod as any).saleEndAt;

    if (nextStart && nextEnd && new Date(nextStart).getTime() > new Date(nextEnd).getTime()) {
      res.status(400).json({ error: 'saleStartAt must be ≤ saleEndAt' });
      return;
    }

    Object.assign(prod, patch, { updatedAt: new Date() });

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
    const id = Number(idParsed.data.id);

    const product = await Product.findOne({
      where: { id, archivedAt: { [Op.is]: null } as any },
    });
    if (!product) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    // Order images with primary first, then sortOrder, then id (hide soft-deleted)
    const images = await ProductImage.findAll({
      where: { productId: id },
      paranoid: true,
      order: [
        ['isPrimary', 'DESC'],
        ['sortOrder', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    const photos = images.map((img: any) => ({
      id: Number(img.id),
      isPrimary: Boolean(img.isPrimary),
      url320: img.url320 ?? null,
      url800: img.url800 ?? null,
      url1600: img.url1600 ?? null,
    }));

    const json = product.toJSON() as Record<string, unknown>;
    (json as any).photos = photos;

    // Optional convenience for UIs that want a single hero image
    const primary = photos.find((p) => p.isPrimary);
    (json as any).primaryImageUrl =
      primary?.url800 ?? primary?.url1600 ?? primary?.url320 ?? null;

    res.json({ product: json });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load product', detail: e?.message });
  }
}


/** ---------------------------------------------
 * Catalog list — filters & sorting (effective price, size range, etc.)
 * --------------------------------------------*/
function saleActiveExpr(nowIso: string) {
  // TRUE when salePriceCents is set and now within [start,end] (nulls open-ended)
  return literal(`("salePriceCents" IS NOT NULL AND
    (("saleStartAt" IS NULL OR "saleStartAt" <= TIMESTAMP '${nowIso}')
     AND ("saleEndAt" IS NULL OR TIMESTAMP '${nowIso}' <= "saleEndAt')))`);
}

function effectivePriceExpr(nowIso: string) {
  return literal(`CASE WHEN "salePriceCents" IS NOT NULL AND
    (("saleStartAt" IS NULL OR "saleStartAt" <= TIMESTAMP '${nowIso}')
     AND ("saleEndAt" IS NULL OR TIMESTAMP '${nowIso}' <= "saleEndAt"))
    THEN "salePriceCents" ELSE "priceCents" END`);
}

export async function listProducts(req: Request, res: Response): Promise<void> {
  const parsed = listProductsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: zDetails(parsed.error) });
    return;
  }

  try {
    const {
      page,
      pageSize,
      vendorId,
      vendorSlug,
      species,
      synthetic,
      onSale,
      // NEW unified names
      priceMinCents,
      priceMaxCents,
      sizeMinCm,
      sizeMaxCm,
      fluorescence,
      condition,
      sort,
      // Back-compat (deprecated)
      minCents,
      maxCents,
    } = parsed.data as any;

    const nowIso = new Date().toISOString();
    const andClauses: any[] = [{ archivedAt: { [Op.is]: null } }];

    // vendor
    if (vendorId) {
      andClauses.push({ vendorId: Number(vendorId) });
    } else if (vendorSlug) {
      const v = await Vendor.findOne({ where: { slug: vendorSlug }, attributes: ['id'] });
      if (!v) {
        res.json({ items: [], page, pageSize, total: 0, totalPages: 0 });
        return;
      }
      andClauses.push({ vendorId: v.id });
    }

    // species / synthetic
    if (species) andClauses.push({ species: { [Op.iLike]: String(species) } });
    if (typeof synthetic === 'boolean') andClauses.push({ synthetic });

    // structured filters
    if (fluorescence) {
      const modes = String(fluorescence).split(',').map((s) => s.trim()).filter(Boolean);
      if (modes.length) andClauses.push({ fluorescenceMode: { [Op.in]: modes } });
    }
    if (condition) {
      const conds = String(condition).split(',').map((s) => s.trim()).filter(Boolean);
      if (conds.length) andClauses.push({ condition: { [Op.in]: conds } });
    }

    // onSale (effective right now via schedule)
    if (typeof onSale !== 'undefined') {
      const expr = saleActiveExpr(nowIso);
      const isTrue = String(onSale).toLowerCase() === 'true';
      if (isTrue) {
        andClauses.push(where(expr, '=', true));
      } else {
        andClauses.push(where(expr, '=', false));
      }
    }

    // effective price range
    const minP = priceMinCents ?? minCents ?? null;
    const maxP = priceMaxCents ?? maxCents ?? null;
    if (minP != null || maxP != null) {
      const eff = effectivePriceExpr(nowIso);
      if (minP != null && maxP != null) {
        andClauses.push(where(eff, { [Op.between]: [Number(minP), Number(maxP)] }));
      } else if (minP != null) {
        andClauses.push(where(eff, { [Op.gte]: Number(minP) }));
      } else if (maxP != null) {
        andClauses.push(where(eff, { [Op.lte]: Number(maxP) }));
      }
    }

    // size range on longest edge (GREATEST of L/W/H)
    const minS = sizeMinCm ?? null;
    const maxS = sizeMaxCm ?? null;
    if (minS != null || maxS != null) {
      const longest = fn('GREATEST', col('lengthCm'), col('widthCm'), col('heightCm'));
      if (minS != null && maxS != null) {
        andClauses.push(where(longest, { [Op.between]: [Number(minS), Number(maxS)] }));
      } else if (minS != null) {
        andClauses.push(where(longest, { [Op.gte]: Number(minS) }));
      } else if (maxS != null) {
        andClauses.push(where(longest, { [Op.lte]: Number(maxS) }));
      }
    }

    // order
    let order: Order;
    if (sort === 'price_asc') {
      order = [[effectivePriceExpr(nowIso), 'ASC'], ['id', 'ASC']] as unknown as Order;
    } else if (sort === 'price_desc') {
      order = [[effectivePriceExpr(nowIso), 'DESC'], ['id', 'DESC']] as unknown as Order;
    } else {
      order = [['createdAt', 'DESC'], ['id', 'DESC']] as unknown as Order;
    }

    const offset = (page - 1) * pageSize;

    const { rows, count } = await Product.findAndCountAll({
      where: { [Op.and]: andClauses },
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

  // ✅ Real per-listing quota: count existing images for this product
  let existingCount = 0;
  try {
    existingCount = await ProductImage.count({
      where: { productId: Number(idParsed.data.id) },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to check image quota', detail: e?.message });
    return;
  }

  if (existingCount >= MAX_IMAGES_PER_LISTING) {
    res.status(400).json({
      error: 'Image limit reached for this listing',
      code: 'LISTING_IMAGE_LIMIT',
      limit: MAX_IMAGES_PER_LISTING,
      existingCount,
      attempted: files.length,
    });
    return;
  }

  const remaining = MAX_IMAGES_PER_LISTING - existingCount;
  if (files.length > remaining) {
    res.status(400).json({
      error: `Too many images for this listing (you can add ${remaining} more)`,
      code: 'LISTING_IMAGE_LIMIT',
      limit: MAX_IMAGES_PER_LISTING,
      existingCount,
      attempted: files.length,
    });
    return;
  }

  // TODO(images): persist originals; generate 320/800/1600 with sharp; save records.
  // For Week-2, return derived variant metadata so the UI can render immediately.
  const responseFiles = files.map((f) => ({
    name: f.originalname,
    type: f.mimetype,
    size: f.size,
    variants: [
      { key: 'orig' as const, bytes: f.size },
      { key: '320' as const, width: 320, height: undefined, bytes: undefined },
      { key: '800' as const, width: 800, height: undefined, bytes: undefined },
      { key: '1600' as const, width: 1600, height: undefined, bytes: undefined },
    ],
  }));

  res.json({
    ok: true,
    received: files.length,
    existingCount,
    files: responseFiles,
  });
}

// POST /products/:id/images/:imageId/primary
export async function setPrimaryImage(req: Request, res: Response) {
  try {
    const { id } = productImageProductIdParam.parse(req.params);
    const { imageId } = imageIdParam.parse(req.params);
    const user = (req.session as any)?.user;

    if (!user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const owns = await assertVendorOwnsProduct(id, user.id, user.role);
    if (!owns) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const sequelize = db.instance();
    if (!sequelize) {
      res.status(500).json({ error: 'Database not configured' });
      return;
    }

    await sequelize.transaction(async (tx: Transaction) => {
      // Ensure image belongs to product (paranoid true → excludes soft-deleted)
      const img = await ProductImage.findOne({
        where: { id: imageId, productId: id },
        transaction: tx,
        paranoid: true,
      });
      if (!img) throw new Error('Image not found for product');

      // Clear other primaries, set this one primary
      await ProductImage.update(
        { isPrimary: false },
        { where: { productId: id }, transaction: tx, paranoid: false }
      );
      await ProductImage.update(
        { isPrimary: true },
        { where: { id: imageId }, transaction: tx, paranoid: false }
      );
    });

    res.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || 'Failed to set primary image';
    res.status(400).json({ error: msg });
  }
}

// POST /products/:id/images/reorder
export async function reorderImages(req: Request, res: Response) {
  try {
    const { id } = productImageProductIdParam.parse(req.params);
    const body = reorderImagesSchema.parse(req.body);
    const user = (req.session as any)?.user;

    if (!user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const owns = await assertVendorOwnsProduct(id, user.id, user.role);
    if (!owns) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Verify all provided images belong to this product and are not soft-deleted
    const imgs = await ProductImage.findAll({ where: { productId: id } }); // paranoid default
    const validIds = new Set(imgs.map((i) => Number(i.id)));
    for (const imageId of body.order) {
      if (!validIds.has(Number(imageId))) {
        res.status(400).json({ error: `Image ${imageId} does not belong to product ${id}` });
        return;
      }
    }

    const sequelize = db.instance();
    if (!sequelize) {
      res.status(500).json({ error: 'Database not configured' });
      return;
    }

    await sequelize.transaction(async (tx: Transaction) => {
      for (let i = 0; i < body.order.length; i += 1) {
        const imageId = body.order[i];
        await ProductImage.update({ sortOrder: i }, { where: { id: imageId }, transaction: tx });
      }
    });

    res.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || 'Failed to reorder images';
    res.status(400).json({ error: msg });
  }
}

// DELETE /products/:id/images/:imageId (soft delete)
export async function softDeleteImage(req: Request, res: Response) {
  try {
    const { id } = productImageProductIdParam.parse(req.params);
    const { imageId } = imageIdParam.parse(req.params);
    const user = (req.session as any)?.user;

    if (!user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const owns = await assertVendorOwnsProduct(id, user.id, user.role);
    if (!owns) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const sequelize = db.instance();
    if (!sequelize) {
      res.status(500).json({ error: 'Database not configured' });
      return;
    }

    await sequelize.transaction(async (tx: Transaction) => {
      const img = await ProductImage.findOne({
        where: { id: imageId, productId: id },
        transaction: tx,
        paranoid: true,
      });
      if (!img) throw new Error('Image not found for product');

      // If primary, clear primary first to satisfy the partial unique index
      if ((img as any).isPrimary === true) {
        await ProductImage.update({ isPrimary: false }, { where: { id: imageId }, transaction: tx });
      }
      await (img as any).destroy({ transaction: tx }); // paranoid → sets deletedAt
    });

    res.status(204).send();
  } catch (e: any) {
    const msg = e?.message || 'Failed to delete image';
    res.status(400).json({ error: msg });
  }
}

// POST /products/:id/images/:imageId/restore
export async function restoreImage(req: Request, res: Response) {
  try {
    const { id } = productImageProductIdParam.parse(req.params);
    const { imageId } = imageIdParam.parse(req.params);
    const user = (req.session as any)?.user;

    if (!user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const owns = await assertVendorOwnsProduct(id, user.id, user.role);
    if (!owns) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const img = await ProductImage.findOne({
      where: { id: imageId, productId: id },
      paranoid: false,
    });
    if (!img) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    await (img as any).restore(); // paranoid restore
    res.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || 'Failed to restore image';
    res.status(400).json({ error: msg });
  }
}
