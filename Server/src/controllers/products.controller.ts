// Server/src/controllers/products.controller.ts
import type { Request, Response } from 'express';
import { db } from '../models/sequelize.js';
import { Op, col, fn, literal, where, type Order, type Transaction } from 'sequelize';
import { z, type ZodError } from 'zod';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';

import { Product } from '../models/product.model.js';
import { Vendor } from '../models/vendor.model.js';
import { ProductImage } from '../models/productImage.model.js';
// NEW: categories
import { Category } from '../models/category.model.js';
import { ProductCategory } from '../models/productCategory.model.js';

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

type ProductListQuery = z.infer<typeof listProductsQuerySchema>;

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

// in products.controller.ts
async function assertVendorOwnsProduct(
  productId: number,
  userId: number,
  role: string
): Promise<boolean> {
  if (role === 'admin' || role === 'superadmin' || role === 'owner') return true;

  if (role !== 'vendor' || !Number.isFinite(userId)) return false;

  const vendor = await Vendor.findOne({ where: { userId }, attributes: ['id'] });
  if (!vendor) return false;

  const p = await Product.findOne({ where: { id: productId }, attributes: ['vendorId'] });
  return !!p && Number(p.vendorId) === Number(vendor.id);
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
 * Upload helpers (Render + local friendly)
 * --------------------------------------------*/
const DEFAULT_UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
export const UPLOADS_PUBLIC_ROUTE = process.env.UPLOADS_PUBLIC_ROUTE ?? '/uploads';

// Use env when present; if it isn’t writable (e.g., local dev), fall back.
const INITIAL_UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : DEFAULT_UPLOADS_DIR;

// Export a const (Sonar OK) whose property we can update internally.
export const UPLOADS_DIR = { current: INITIAL_UPLOADS_DIR };

export async function ensureUploadsReady() {
  try {
    await fs.mkdir(UPLOADS_DIR.current, { recursive: true });
    const test = path.join(UPLOADS_DIR.current, '.writecheck');
    await fs.writeFile(test, 'ok');
    await fs.unlink(test);
  } catch (e: any) {
    if (e?.code === 'EACCES' || e?.code === 'EPERM') {
      UPLOADS_DIR.current = DEFAULT_UPLOADS_DIR;               // <— re-point here
      await fs.mkdir(UPLOADS_DIR.current, { recursive: true });
      const test = path.join(UPLOADS_DIR.current, '.writecheck');
      await fs.writeFile(test, 'ok');
      await fs.unlink(test);
    } else {
      throw e;
    }
  }
}


async function ensureDir(p: string) { await fs.mkdir(p, { recursive: true }); }

function toPublicUrl(rel?: string | null) {
  if (!rel) return null;
  const s = String(rel).replace(/^\/+/, '');
  // Always mount uploads under UPLOADS_PUBLIC_ROUTE
  return `${UPLOADS_PUBLIC_ROUTE}/${s}`;
}

function variantFilename(baseNoExt: string, sizeLabel: 'orig' | '320' | '800' | '1600') {
  const suffix = sizeLabel === 'orig' ? '' : `_${sizeLabel}`;
  return `${baseNoExt}${suffix}.jpg`;
}

const isSupportedImage = (m?: string) => !!m && /^image\/(jpe?g|png|webp|tiff|gif|heic|heif|avif)$/i.test(m);

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

        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      } as any
    );

    // NEW: Assign the single required category
    await ProductCategory.destroy({ where: { productId: Number(created.id) } });
    await ProductCategory.create({
      productId: Number(created.id),
      categoryId: Number(p.categoryId),
    });

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

    // NEW: If categoryId provided, reset the single link
    if (Object.prototype.hasOwnProperty.call(p, 'categoryId')) {
      await ProductCategory.destroy({ where: { productId: Number(prod.id) } });
      await ProductCategory.create({
        productId: Number(prod.id),
        categoryId: Number(p.categoryId),
      });
    }

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

// --- ADD BELOW deleteProduct() (and export) ---

// POST /products/:id/archive  → set archivedAt (soft-delete)
export async function archiveProduct(req: Request, res: Response): Promise<void> {
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
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to archive product', detail: e?.message });
  }
}

// POST /products/:id/revive  → clear archivedAt (unarchive)
export async function reviveProduct(req: Request, res: Response): Promise<void> {
  if (!ensureAuthed(req, res)) return;

  const idParsed = productIdParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    res.status(400).json({ error: 'Invalid product id', details: zDetails(idParsed.error) });
    return;
  }

  const vendor = await requireVendor(req, res);
  if (!vendor) return;

  const prod = await Product.findOne({
    // allow finding even if currently archived
    where: { id: idParsed.data.id, vendorId: vendor.id },
  });
  if (!prod) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  try {
    (prod as any).archivedAt = null; // unarchive
    await (prod as any).save();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to revive product', detail: e?.message });
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
      include: [
        {
          model: Vendor,
          as: 'vendor',
          attributes: ['slug'], // only slug; 'name' column doesn't exist
        },
      ],
    });
    if (!product) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    // Images: primary first, then sort order, then id; hide soft-deleted (paranoid: true)
    const images = await ProductImage.findAll({
      where: { productId: id },
      paranoid: true,
      attributes: [
        'id',
        'isPrimary',
        'sortOrder',
        'origPath',
        'v320Path',
        'v800Path',
        'v1600Path',
      ],
      order: [
        ['isPrimary', 'DESC'],
        ['sortOrder', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    const photos = images.map((img: any) => {
      const url320 = toPublicUrl(img.v320Path);
      const url800 = toPublicUrl(img.v800Path);
      const url1600 = toPublicUrl(img.v1600Path);
      const urlOrig = toPublicUrl(img.origPath);
      const best = url1600 ?? url800 ?? url320 ?? urlOrig ?? null;
      return {
        id: Number(img.id),
        isPrimary: Boolean(img.isPrimary),
        url320,
        url800,
        url1600,
        url: best,
      };
    });

    const json = product.toJSON() as Record<string, unknown>;
    (json as any).photos = photos;

    // Convenience: a single hero image for UIs that want it
    const primary = photos.find((p) => p.isPrimary) ?? photos[0] ?? null;
    (json as any).primaryImageUrl = primary?.url ?? null;

    // NEW: flatten vendor slug for client consumption
    (json as any).vendorSlug = (json as any).vendor?.slug ?? null;
    // Optional: drop nested vendor object to keep payload lean
    // delete (json as any).vendor;

    res.json({ product: json });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load product', detail: e?.message });
  }
}



/** ---------------------------------------------
 * Catalog list — filters & sorting (effective price, size range, etc.)
 * --------------------------------------------*/

// NOTE: Removed saleActiveExpr to avoid raw SQL quoting issues.

// Keep effective price expression for range/sort:
function effectivePriceExpr(nowIso: string) {
  return literal(`CASE WHEN "salePriceCents" IS NOT NULL AND
    (("saleStartAt" IS NULL OR "saleStartAt" <= TIMESTAMP '${nowIso}')
     AND ("saleEndAt" IS NULL OR TIMESTAMP '${nowIso}' <= "saleEndAt"))
    THEN "salePriceCents" ELSE "priceCents" END`);
}

export async function listProducts(req: Request, res: Response): Promise<void> {
  // ✅ Prefer the validated query stashed by validateQuery(); fallback to parsing once if absent.
  let q: ProductListQuery | null = (res.locals.query as ProductListQuery) ?? null;
  if (!q) {
    const parsed = listProductsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query', details: zDetails(parsed.error) });
      return;
    }
    q = parsed.data;
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
      priceMinCents,
      priceMaxCents,
      sizeMinCm,
      sizeMaxCm,
      fluorescence,
      condition,
      sort,

      // NEW: category filters + dollar inputs
      category,
      categoryId,
      priceMin, // dollars
      priceMax, // dollars

      // Back-compat (deprecated)
      minCents,
      maxCents,
    } = q as any;

    const now = new Date();
    const nowIso = now.toISOString();
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

    // ✅ onSale (no raw SQL)
    if (typeof onSale !== 'undefined') {
      const onSaleTrueClauses = [
        { salePriceCents: { [Op.ne]: null } },
        { [Op.or]: [{ saleStartAt: null }, { saleStartAt: { [Op.lte]: now } }] },
        { [Op.or]: [{ saleEndAt: null }, { saleEndAt: { [Op.gte]: now } }] },
      ];

      const isTrue = String(onSale).toLowerCase() === 'true';
      if (isTrue) {
        andClauses.push({ [Op.and]: onSaleTrueClauses });
      } else {
        andClauses.push({ [Op.not]: { [Op.and]: onSaleTrueClauses } });
      }
    }

    // effective price range — support dollars (priceMin/priceMax) and cents (new/legacy)
    const dMin = typeof priceMin === 'number' ? Math.round(priceMin * 100) : undefined;
    const dMax = typeof priceMax === 'number' ? Math.round(priceMax * 100) : undefined;
    const minP = (dMin ?? priceMinCents ?? minCents) ?? null;
    const maxP = (dMax ?? priceMaxCents ?? maxCents) ?? null;
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
    } else if (sort === 'oldest') {
      order = [['createdAt', 'ASC'], ['id', 'ASC']] as unknown as Order;
    } else {
      order = [['createdAt', 'DESC'], ['id', 'DESC']] as unknown as Order;
    }

    const offset = (page - 1) * pageSize;

    // Build include chain
    const include: any[] = [];

    // NEW: category join (by slug or id)
    if (category || categoryId) {
      const whereCat: any = {};
      if (category) whereCat.slug = String(category);
      if (categoryId) whereCat.id = Number(categoryId);

      include.push({
        model: Category,
        as: 'categories',
        through: { attributes: [] },
        where: whereCat,
        required: true,
        attributes: ['id', 'name', 'slug'],
      });
    }

    // ONE image per product, ordered by primary → sortOrder → id
    include.push({
      model: ProductImage,
      as: 'images',
      attributes: ['v320Path', 'v800Path', 'v1600Path', 'origPath', 'isPrimary', 'sortOrder'],
      separate: true,
      limit: 1,
      order: [
        ['isPrimary', 'DESC'],
        ['sortOrder', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    // 👇 NEW: include vendor so we can surface slug/name to the client
    include.push({
      model: Vendor,
      as: 'vendor',
      attributes: ['id', 'slug'],
    });

    const { rows, count } = await Product.findAndCountAll({
      where: { [Op.and]: andClauses },
      order,
      offset,
      limit: pageSize,
      include,
      distinct: true, // keep count accurate when a join is present
    });

    // Flatten a primaryImageUrl + vendorSlug/vendorName for the client
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
        // Optional: trim nested objects for a lean payload
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
    res.status(500).json({ error: 'Failed to list products', detail: e?.message });
  }
}



/** ---------------------------------------------
 * Images attach — generates 320/800/1600 and stores DB rows
 * --------------------------------------------*/

// One place to control the listing quota (env overridable)
const MAX_IMAGES_PER_LISTING = Number(process.env.UPLOAD_MAX_IMAGES_PER_LISTING ?? 4);

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

  // Per-listing quota
  const existingCount = await ProductImage.count({ where: { productId: Number(idParsed.data.id) } });
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

  await ensureUploadsReady();

  // Storage layout: uploads/images/<productId>/
  const productDirRel = `images/${idParsed.data.id}`;
  const productDirAbs = path.join(UPLOADS_DIR.current, productDirRel);
  await ensureDir(productDirAbs);

  const createdResponses: Array<{
    name: string;
    type: string;
    size: number;
    variants: Array<{ key: 'orig' | '320' | '800' | '1600'; width?: number; height?: number; bytes?: number; url?: string }>;
  }> = [];

  // Determine if product already has a primary
  const hasPrimary = (await ProductImage.count({
    where: { productId: Number(idParsed.data.id), isPrimary: true },
  })) > 0;

  for (let index = 0; index < files.length; index += 1) {
    const f = files[index];

    if (!isSupportedImage(f.mimetype)) {
      res.status(400).json({ ok: false, code: 'UNSUPPORTED_MEDIA_TYPE', message: `Unsupported file type: ${f.mimetype}` });
      return;
    }

    // Multer may be memory or disk storage — handle both
    const inputBuffer = (f as any).buffer ?? await fs.readFile((f as any).path);

    const base = path.parse(f.originalname).name
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '');
    const stamp = Date.now().toString(36);
    const baseNoExt = `${base}_${stamp}`;

    // Write original as JPG to normalize
    const origFilename = variantFilename(baseNoExt, 'orig');
    const origRel = `${productDirRel}/${origFilename}`;
    const origAbs = path.join(UPLOADS_DIR.current, origRel);
    await sharp(inputBuffer).jpeg({ quality: 90 }).toFile(origAbs);
    const origStat = await fs.stat(origAbs);

    // Derivatives
    const sizes: Array<{ label: '320' | '800' | '1600'; width: number }> = [
      { label: '320', width: 320 },
      { label: '800', width: 800 },
      { label: '1600', width: 1600 },
    ];
    const out: Record<'320' | '800' | '1600', { rel: string; abs: string; bytes: number }> = {} as any;

    for (const s of sizes) {
      const fn = variantFilename(baseNoExt, s.label);
      const rel = `${productDirRel}/${fn}`;
      const abs = path.join(UPLOADS_DIR.current, rel);

      await sharp(inputBuffer)
        .resize({ width: s.width, withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toFile(abs);

      const st = await fs.stat(abs);
      out[s.label] = { rel, abs, bytes: st.size };
    }

    // Create DB row (includes required non-null fields)
    await ProductImage.create({
      productId: Number(idParsed.data.id),
      isPrimary: hasPrimary ? false : index === 0,
      sortOrder: existingCount + index,

      // required columns in your model
      fileName: f.originalname,
      mimeType: 'image/jpeg',     // normalized output
      origBytes: origStat.size,

      // stored paths for variants
      origPath: origRel,
      v320Path: out['320'].rel,
      v800Path: out['800'].rel,
      v1600Path: out['1600'].rel,
    } as any);

    createdResponses.push({
      name: f.originalname,
      type: f.mimetype,
      size: f.size,
      variants: [
        { key: 'orig', bytes: origStat.size, url: toPublicUrl(origRel) ?? undefined },
        { key: '320', width: 320, bytes: out['320'].bytes, url: toPublicUrl(out['320'].rel) ?? undefined },
        { key: '800', width: 800, bytes: out['800'].bytes, url: toPublicUrl(out['800'].rel) ?? undefined },
        { key: '1600', width: 1600, bytes: out['1600'].bytes, url: toPublicUrl(out['1600'].rel) ?? undefined },
      ],
    });
  }

  res.json({
    ok: true,
    received: files.length,
    existingCount,
    files: createdResponses,
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
