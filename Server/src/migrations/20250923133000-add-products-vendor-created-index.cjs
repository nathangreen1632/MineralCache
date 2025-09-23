// Server/src/migrations/20250923133000-add-products-vendor-created-index.cjs
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(q) {
        await q.sequelize.query(`
      CREATE INDEX IF NOT EXISTS products_vendor_created_idx
      ON "products" ("vendorId","createdAt");
    `);
    },

    async down(q) {
        await q.sequelize.query(`
      DROP INDEX IF EXISTS products_vendor_created_idx;
    `);
    },
};
