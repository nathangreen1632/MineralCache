/** @type {import('sequelize-cli').Migration} */
module.exports = {
    // NOTE: Do NOT wrap in a transaction; CREATE INDEX CONCURRENTLY is not allowed in a tx.
    async up(queryInterface) {
        // ===== Orders =====
        await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_buyer_created_idx
      ON orders ("buyerUserId", "createdAt");
    `);

        // ===== Order Items =====
        await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS order_items_vendor_created_idx
      ON order_items ("vendorId", "createdAt");
    `);

        // ===== Products (catalog browsing) =====
        await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS products_created_active_idx
      ON products ("createdAt")
      WHERE "archivedAt" IS NULL;
    `);

        await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS products_on_sale_created_active_idx
      ON products ("onSale", "createdAt")
      WHERE "archivedAt" IS NULL;
    `);

        // ===== Products (search) — trigram indexes (guarded) =====
        await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        -- title
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 'products_title_trgm_idx'
        ) THEN
          EXECUTE 'CREATE INDEX CONCURRENTLY products_title_trgm_idx ON products USING gin (title gin_trgm_ops)';
        END IF;

        -- species (if column exists)
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'products' AND column_name = 'species'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 'products_species_trgm_idx'
        ) THEN
          EXECUTE 'CREATE INDEX CONCURRENTLY products_species_trgm_idx ON products USING gin (species gin_trgm_ops)';
        END IF;

        -- locality (if column exists)
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'products' AND column_name = 'locality'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 'products_locality_trgm_idx'
        ) THEN
          EXECUTE 'CREATE INDEX CONCURRENTLY products_locality_trgm_idx ON products USING gin (locality gin_trgm_ops)';
        END IF;
      END
      $$;
    `);
    },

    async down(queryInterface) {
        // Drop indexes if present (also avoid transaction)
        await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS orders_buyer_created_idx;
    `);
        await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS order_items_vendor_created_idx;
    `);
        await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS products_created_active_idx;
    `);
        await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS products_on_sale_created_active_idx;
    `);
        await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS products_title_trgm_idx;
    `);
        await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS products_species_trgm_idx;
    `);
        await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS products_locality_trgm_idx;
    `);
    },
};
