'use strict';

module.exports = {
    async up(queryInterface) {
        // raw SQL so we can use CONCURRENTLY
        await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_buyer_created_idx
        ON orders ("buyerUserId", "createdAt");
    `);

        await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS order_items_vendor_created_idx
        ON order_items ("vendorId", "createdAt");
    `);

        // Active products by createdAt (only non-archived)
        await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS products_created_active_idx
        ON products ("createdAt")
        WHERE "archivedAt" IS NULL;
    `);

        // 🔁 FIX: use salePriceCents instead of non-existent "onSale"
        // Helps queries that prioritize "on sale" items; still only non-archived
        await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS products_sale_created_active_idx
        ON products ("createdAt")
        WHERE "archivedAt" IS NULL AND "salePriceCents" IS NOT NULL;
    `);
    },

    async down(queryInterface) {
        // drop in reverse order; IF EXISTS for safety
        await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS products_sale_created_active_idx;
    `);
        await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS products_created_active_idx;
    `);
        await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS order_items_vendor_created_idx;
    `);
        await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS orders_buyer_created_idx;
    `);
    },
};
