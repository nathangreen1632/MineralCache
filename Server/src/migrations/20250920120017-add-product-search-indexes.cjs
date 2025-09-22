'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        // Case-insensitive lookups
        await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_products_title_lower
      ON products (lower(title));
    `);

        await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_products_species_lower
      ON products (lower(species));
    `);

        await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_products_locality_lower
      ON products (lower(locality));
    `);

        // Helpful for common filters/sorts used by the catalog
        await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_products_archived_null
      ON products (archived_at) WHERE archived_at IS NULL;
    `);

        await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_products_price_cents
      ON products (price_cents);
    `);

        await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_products_created_at
      ON products (created_at DESC);
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
