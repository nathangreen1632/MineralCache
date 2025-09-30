// Server/src/migrations/20250920120017-add-product-search-indexes.cjs

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        // Case-insensitive lookups
        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_products_title_lower
                ON "products" (lower(title));
        `);

        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_products_species_lower
                ON "products" (lower(species));
        `);

        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_products_locality_lower
                ON "products" (lower(locality));
        `);

        // Replace bad archived_at reference with a partial index for non-archived rows
        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_products_archived_null
                ON "products"(id)
                WHERE status <> 'archived'::"public"."enum_products_status";
        `);

        // Price and createdAt use camelCase column names in this schema
        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_products_price_cents
                ON "products" ("priceCents");
        `);

        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_products_created_at
                ON "products" ("createdAt" DESC);
        `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_products_title_lower;`);
        await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_products_species_lower;`);
        await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_products_locality_lower;`);
        await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_products_archived_null;`);
        await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_products_price_cents;`);
        await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_products_created_at;`);
    },
};
