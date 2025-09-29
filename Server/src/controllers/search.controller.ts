import type { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { db } from '../models/sequelize.js';

function parsePage(v: unknown, def = 1) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.floor(n);
}
function parsePageSize(v: unknown, def = 20) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return def;
  return Math.floor(n);
}

/**
 * GET /api/search?q=...&page=1&pageSize=20&onSale=true
 * - Uses ILIKE against title/species/locality (trigram-backed)
 * - Orders by similarity when q is long enough; otherwise by createdAt DESC
 * - Returns { items, total, page, pageSize }
 */
export async function searchProducts(req: Request, res: Response): Promise<void> {
  const qRaw = String((req.query as any)?.q ?? '').trim();
  const page = parsePage((req.query as any)?.page, 1);
  const pageSize = parsePageSize((req.query as any)?.pageSize, 20);
  const onSale = (req.query as any)?.onSale;
  const wantOnSale =
    typeof onSale === 'string' ? onSale.toLowerCase() === 'true' : Boolean(onSale);

  const sequelize = db.instance();
  if (!sequelize) {
    res.status(500).json({ error: 'DB not initialized' });
    return;
  }

  // Base filters
  const whereParts: string[] = [`"archivedAt" IS NULL`];
  const binds: Record<string, any> = {};

  // Filter onSale if requested
  if (wantOnSale) {
    whereParts.push(`"onSale" = TRUE`);
  }

  // Search predicate
  let orderClause = `ORDER BY "createdAt" DESC`;
  if (qRaw.length > 0) {
    // ILIKE with wildcards; trigram index will accelerate this
    whereParts.push(`(
      title ILIKE :q
      OR COALESCE(species, '') ILIKE :q
      OR COALESCE(locality, '') ILIKE :q
    )`);
    binds.q = `%${qRaw}%`;

    // If query is reasonably long, rank by similarity()
    if (qRaw.length >= 2) {
      orderClause = `
        ORDER BY GREATEST(
          similarity(title, :qraw),
          similarity(COALESCE(species, ''), :qraw),
          similarity(COALESCE(locality, ''), :qraw)
        ) DESC, "createdAt" DESC
      `;
      binds.qraw = qRaw;
    }
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  // Count first
  const countSql = `
    SELECT COUNT(*)::bigint AS cnt
    FROM products
    ${whereSql}
  `;
  const [{ cnt }] = await sequelize.query<{ cnt: string }>(countSql, {
    type: QueryTypes.SELECT,
    replacements: binds,
  });

  // Page
  const offset = (page - 1) * pageSize;
  const listSql = `
    SELECT
      id,
      title,
      "priceCents",
      "salePriceCents",
      "onSale",
      "createdAt",
      COALESCE(primary_photo_url, NULL) AS "primaryPhotoUrl"
    FROM products
    ${whereSql}
    ${orderClause}
    LIMIT :limit OFFSET :offset
  `;

  const items = await sequelize.query<any>(listSql, {
    type: QueryTypes.SELECT,
    replacements: { ...binds, limit: pageSize, offset },
  });

  res.json({
    page,
    pageSize,
    total: Number(cnt || 0),
    items: items.map((p: any) => ({
      id: Number(p.id),
      title: String(p.title),
      priceCents: Number(p.priceCents ?? p.pricecents ?? p.price_cents ?? 0),
      salePriceCents: p.salePriceCents == null ? null : Number(p.salePriceCents),
      onSale: Boolean(p.onSale),
      createdAt: p.createdAt,
      primaryPhotoUrl: p.primaryPhotoUrl ?? null,
    })),
  });
}
