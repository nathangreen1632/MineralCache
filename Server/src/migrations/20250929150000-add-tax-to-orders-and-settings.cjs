'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // --- admin_settings: add tax_rate_bps, tax_label
        await queryInterface.addColumn('admin_settings', 'tax_rate_bps', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
        });

        await queryInterface.addColumn('admin_settings', 'tax_label', {
            type: Sequelize.STRING(64),
            allowNull: true,
            defaultValue: null,
        });

        // --- orders: add tax_cents
        await queryInterface.addColumn('orders', 'tax_cents', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
        });

        // --- Postgres-only: extend enum to include 'cancelled' (no-op if exists)
        // If you use another dialect, this will be skipped.
        const dialect = queryInterface.sequelize.getDialect();
        if (dialect === 'postgres') {
            await queryInterface.sequelize.query(
                'ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS \'cancelled\';'
            );
        }
    },

    async down(queryInterface, Sequelize) {
        // Reverse column additions
        await queryInterface.removeColumn('orders', 'tax_cents').catch(() => {});
        await queryInterface.removeColumn('admin_settings', 'tax_label').catch(() => {});
        await queryInterface.removeColumn('admin_settings', 'tax_rate_bps').catch(() => {});

        // NOTE: Postgres enum values cannot be removed safely once added.
        // We intentionally do not attempt to drop 'cancelled' from enum_orders_status.
    },
};
