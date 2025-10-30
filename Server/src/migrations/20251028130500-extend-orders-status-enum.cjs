'use strict';

module.exports = {
    async up(queryInterface) {
        // Add missing values so writes won't fail
        await queryInterface.sequelize.query(
            `ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'pending_payment';`
        );
        await queryInterface.sequelize.query(
            `ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'failed';`
        );

        // Optional: normalize existing rows from 'pending' -> 'pending_payment'
        // Comment out if you want to keep 'pending' as a historical value.
        await queryInterface.sequelize.query(
            `UPDATE "orders" SET "status" = 'pending_payment' WHERE "status" = 'pending';`
        );
    },

    async down() {
        // No-op: dropping enum values requires a full recreate; intentionally omitted.
    },
};
