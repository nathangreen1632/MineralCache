// Server/src/migrations/20250929180500-add-products-trgm-indexes.cjs
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    // Needed for CREATE INDEX CONCURRENTLY in Postgres
    useTransaction: false,

    async up(queryInterface) {
        // Ensure the extension exists (safe if already enabled by your 20250929170000 migration)
        await queryInterface.sequelize.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `);

        // Trigram GIN indexes to speed up ILIKE searches on active (non-archived) products
        await queryInterface.sequelize.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS products_title_trgm
                ON products USING GIN ("title" gin_trgm_ops)
                WHERE "archivedAt" IS NULL;
        `);

        await queryInterface.sequelize.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS products_species_trgm
                ON products USING GIN ("species" gin_trgm_ops)
                WHERE "archivedAt" IS NULL;
        `);

        await queryInterface.sequelize.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS products_locality_trgm
                ON products USING GIN ("locality" gin_trgm_ops)
                WHERE "archivedAt" IS NULL;
        `);
    },

    async down(queryInterface) {
        // Drop indexes; leave the extension installed (harmless, may be reused elsewhere)
        await queryInterface.sequelize.query(`
            DROP INDEX CONCURRENTLY IF EXISTS products_title_trgm;
        `);
        await queryInterface.sequelize.query(`
            DROP INDEX CONCURRENTLY IF EXISTS products_species_trgm;
        `);
        await queryInterface.sequelize.query(`
            DROP INDEX CONCURRENTLY IF EXISTS products_locality_trgm;
        `);
    },
};
