'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(q) {
        const t = await q.sequelize.transaction();
        try {
            // be polite to prod
            await q.sequelize.query(
                `SET LOCAL lock_timeout TO '5s'; SET LOCAL statement_timeout TO '120s';`,
                { transaction: t }
            );

            // Drop the older duplicates created by 20250920120017-add-product-search-indexes
            await q.sequelize.query(
                `DROP INDEX IF EXISTS public.idx_products_price_cents;`,
                { transaction: t }
            );
            await q.sequelize.query(
                `DROP INDEX IF EXISTS public.idx_products_created_at;`,
                { transaction: t }
            );

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },

    async down(q) {
        const t = await q.sequelize.transaction();
        try {
            // Re-create the old indexes if you rollback this migration
            await q.sequelize.query(
                `CREATE INDEX IF NOT EXISTS idx_products_price_cents ON "products" ("priceCents");`,
                { transaction: t }
            );
            // original was created as DESC; keep that shape here
            await q.sequelize.query(
                `CREATE INDEX IF NOT EXISTS idx_products_created_at ON "products" ("createdAt" DESC);`,
                { transaction: t }
            );

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },
};
