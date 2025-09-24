'use strict';

/**
 * Add "isPrimary" + "deletedAt" to product_images for:
 * - primary photo selection (1 per product)
 * - soft-delete/restore
 *
 * Also ensure sortOrder exists (idempotent), and add indexes:
 * - UNIQUE (productId) WHERE isPrimary = TRUE
 * - (productId, deletedAt) for faster active queries
 *
 * Safe to run multiple times.
 */

module.exports = {
    async up(q) {
        const sql = (s) => q.sequelize.query(s);

        await sql(`
      ALTER TABLE product_images
        ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0
    `);

        // One-primary-per-product (partial unique)
        await sql(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'product_images_one_primary_per_product'
        ) THEN
          CREATE UNIQUE INDEX product_images_one_primary_per_product
            ON product_images ("productId")
            WHERE "isPrimary" = TRUE;
        END IF;
      END$$;
    `);

        // Helpful for filtering "active" (deletedAt IS NULL)
        await sql(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'product_images_product_deleted_idx'
        ) THEN
          CREATE INDEX product_images_product_deleted_idx
            ON product_images ("productId", "deletedAt");
        END IF;
      END$$;
    `);

        // Keep the existing sort index pattern consistent (idempotent)
        await sql(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'product_images_product_sort_idx'
        ) THEN
          CREATE INDEX product_images_product_sort_idx
            ON product_images ("productId", "sortOrder");
        END IF;
      END$$;
    `);
    },

    async down(q) {
        const sql = (s) => q.sequelize.query(s);

        await sql(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'product_images_one_primary_per_product') THEN
          DROP INDEX product_images_one_primary_per_product;
        END IF;
      END$$;
    `);

        await sql(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'product_images_product_deleted_idx') THEN
          DROP INDEX product_images_product_deleted_idx;
        END IF;
      END$$;
    `);

        // Leave sortOrder in place (harmless). Remove new columns:
        await sql(`
      ALTER TABLE product_images
        DROP COLUMN IF EXISTS "isPrimary",
        DROP COLUMN IF EXISTS "deletedAt"
    `);
    },
};
