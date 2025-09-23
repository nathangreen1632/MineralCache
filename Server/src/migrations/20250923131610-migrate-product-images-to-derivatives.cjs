'use strict';

/**
 * Migrate legacy product_images (url/w/h/sort) to the new
 * derivatives-friendly schema used by ProductImage model:
 * fileName, mimeType, origPath/Bytes/Width/Height, v320/v800/v1600*, sortOrder.
 *
 * - Adds any missing columns (IF NOT EXISTS)
 * - Backfills from legacy columns
 * - Creates useful indexes
 * - Drops legacy columns (url, w, h, sort)
 *
 * Safe to run multiple times.
 */

module.exports = {
    async up(q /*, Sequelize */) {
        const sql = (s) => q.sequelize.query(s);

        // --- 1) Add new columns if missing (initially nullable/defaulted, then tighten) ---
        await sql(`ALTER TABLE product_images
      ADD COLUMN IF NOT EXISTS "fileName"   VARCHAR(260),
      ADD COLUMN IF NOT EXISTS "mimeType"   VARCHAR(100) DEFAULT 'image/jpeg',
      ADD COLUMN IF NOT EXISTS "origPath"   VARCHAR(500),
      ADD COLUMN IF NOT EXISTS "origBytes"  INTEGER      DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "origWidth"  INTEGER,
      ADD COLUMN IF NOT EXISTS "origHeight" INTEGER,
      ADD COLUMN IF NOT EXISTS "v320Path"   VARCHAR(500),
      ADD COLUMN IF NOT EXISTS "v320Bytes"  INTEGER,
      ADD COLUMN IF NOT EXISTS "v320Width"  INTEGER,
      ADD COLUMN IF NOT EXISTS "v320Height" INTEGER,
      ADD COLUMN IF NOT EXISTS "v800Path"   VARCHAR(500),
      ADD COLUMN IF NOT EXISTS "v800Bytes"  INTEGER,
      ADD COLUMN IF NOT EXISTS "v800Width"  INTEGER,
      ADD COLUMN IF NOT EXISTS "v800Height" INTEGER,
      ADD COLUMN IF NOT EXISTS "v1600Path"  VARCHAR(500),
      ADD COLUMN IF NOT EXISTS "v1600Bytes" INTEGER,
      ADD COLUMN IF NOT EXISTS "v1600Width" INTEGER,
      ADD COLUMN IF NOT EXISTS "v1600Height" INTEGER,
      ADD COLUMN IF NOT EXISTS "sortOrder"  INTEGER      DEFAULT 0
    ;`);

        // --- 2) Backfill new columns from legacy data, when present ---
        // origPath <- url ; origWidth <- w ; origHeight <- h ; sortOrder <- sort
        await sql(`
      UPDATE product_images
      SET
        "origPath"   = COALESCE("origPath", "url"),
        "origWidth"  = COALESCE("origWidth", "w"),
        "origHeight" = COALESCE("origHeight", "h"),
        "sortOrder"  = COALESCE(NULLIF("sortOrder", 0), COALESCE("sort", 0))
      WHERE
        ("url" IS NOT NULL AND "origPath" IS NULL)
        OR ("w" IS NOT NULL AND "origWidth" IS NULL)
        OR ("h" IS NOT NULL AND "origHeight" IS NULL)
        OR ("sort" IS NOT NULL AND ("sortOrder" = 0 OR "sortOrder" IS NULL));
    `);

        // fileName from last path segment of origPath/url (fallback "image"),
        // mimeType default stays 'image/jpeg', origBytes defaulted to 0 already.
        await sql(`
      UPDATE product_images
      SET
        "fileName" = COALESCE(
          "fileName",
          NULLIF(REGEXP_REPLACE(COALESCE("origPath","url"), '^.*/', ''), ''),
          'image'
        ),
        "mimeType" = COALESCE("mimeType", 'image/jpeg'),
        "origBytes" = COALESCE("origBytes", 0)
      WHERE "fileName" IS NULL OR "mimeType" IS NULL OR "origBytes" IS NULL;
    `);

        // --- 3) Tighten NOT NULLs to match the model (after backfill) ---
        await sql(`ALTER TABLE product_images
      ALTER COLUMN "fileName"  SET NOT NULL,
      ALTER COLUMN "mimeType"  SET NOT NULL,
      ALTER COLUMN "origPath"  SET NOT NULL,
      ALTER COLUMN "origBytes" SET NOT NULL,
      ALTER COLUMN "sortOrder" SET NOT NULL
    ;`);

        // --- 4) Create useful indexes (idempotent) ---
        await sql(`CREATE INDEX IF NOT EXISTS product_images_productId_idx
               ON product_images("productId");`);
        await sql(`CREATE INDEX IF NOT EXISTS product_images_product_sort_idx
               ON product_images("productId","sortOrder");`);
        await sql(`CREATE INDEX IF NOT EXISTS product_images_product_created_idx
               ON product_images("productId","createdAt");`);

        // --- 5) Drop legacy columns if they exist ---
        await sql(`ALTER TABLE product_images
      DROP COLUMN IF EXISTS "url",
      DROP COLUMN IF EXISTS "w",
      DROP COLUMN IF EXISTS "h",
      DROP COLUMN IF EXISTS "sort"
    ;`);
    },

    async down(q /*, Sequelize */) {
        const sql = (s) => q.sequelize.query(s);

        // Recreate legacy columns (if needed) and backfill from new schema,
        // then drop the new derivative columns. This restores the original shape.
        await sql(`ALTER TABLE product_images
      ADD COLUMN IF NOT EXISTS "url"  VARCHAR(500),
      ADD COLUMN IF NOT EXISTS "w"    INTEGER,
      ADD COLUMN IF NOT EXISTS "h"    INTEGER,
      ADD COLUMN IF NOT EXISTS "sort" INTEGER DEFAULT 0
    ;`);

        await sql(`
      UPDATE product_images
      SET
        "url"  = COALESCE("url", "origPath"),
        "w"    = COALESCE("w", "origWidth"),
        "h"    = COALESCE("h", "origHeight"),
        "sort" = COALESCE("sort", "sortOrder")
      WHERE "url" IS NULL OR "w" IS NULL OR "h" IS NULL OR "sort" IS NULL;
    `);

        // Drop derivative-era indexes
        await sql(`DROP INDEX IF EXISTS product_images_product_created_idx;`);
        await sql(`DROP INDEX IF EXISTS product_images_product_sort_idx;`);
        await sql(`DROP INDEX IF EXISTS product_images_productId_idx;`);

        // Drop new columns (keep table)
        await sql(`ALTER TABLE product_images
      DROP COLUMN IF EXISTS "fileName",
      DROP COLUMN IF EXISTS "mimeType",
      DROP COLUMN IF EXISTS "origPath",
      DROP COLUMN IF EXISTS "origBytes",
      DROP COLUMN IF EXISTS "origWidth",
      DROP COLUMN IF EXISTS "origHeight",
      DROP COLUMN IF EXISTS "v320Path",
      DROP COLUMN IF EXISTS "v320Bytes",
      DROP COLUMN IF EXISTS "v320Width",
      DROP COLUMN IF EXISTS "v320Height",
      DROP COLUMN IF EXISTS "v800Path",
      DROP COLUMN IF EXISTS "v800Bytes",
      DROP COLUMN IF EXISTS "v800Width",
      DROP COLUMN IF EXISTS "v800Height",
      DROP COLUMN IF EXISTS "v1600Path",
      DROP COLUMN IF EXISTS "v1600Bytes",
      DROP COLUMN IF EXISTS "v1600Width",
      DROP COLUMN IF EXISTS "v1600Height",
      DROP COLUMN IF EXISTS "sortOrder"
    ;`);
    },
};
