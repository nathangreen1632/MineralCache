'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const t = await queryInterface.sequelize.transaction();
        try {
            // Step 1: Fill buyerUserId with userId (just to avoid constraint errors)
            await queryInterface.sequelize.query(
                `UPDATE "orders" SET "buyerUserId" = "userId" WHERE "buyerUserId" IS NULL`,
                { transaction: t }
            );

            // Step 2: Drop indexes that reference buyerUserId
            await queryInterface.sequelize.query(
                `DO $$ BEGIN
           IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'orders_buyer_created_idx') THEN
             DROP INDEX IF EXISTS "orders_buyer_created_idx";
           END IF;
           IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'orders_buyerUserId_idx') THEN
             DROP INDEX IF EXISTS "orders_buyerUserId_idx";
           END IF;
         END $$;`,
                { transaction: t }
            );

            // Step 3: Drop the stray column
            await queryInterface.removeColumn('orders', 'buyerUserId', { transaction: t });

            // Step 4: Recreate proper index on userId
            await queryInterface.sequelize.query(
                `CREATE INDEX IF NOT EXISTS orders_buyer_created_idx ON "orders" ("userId", "createdAt")`,
                { transaction: t }
            );

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },

    async down() {
        // No rollback — safe forward-only
    },
};
