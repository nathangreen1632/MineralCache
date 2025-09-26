// Server/db/migrations/20250926140200-add-order-items-commission-fields.cjs
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const table = 'order_items';
        const describe = await queryInterface.describeTable(table);

        // Add commissionPct (decimal ratio, e.g., 0.08000 for 8%)
        if (!describe.commissionPct) {
            await queryInterface.addColumn(table, 'commissionPct', {
                type: Sequelize.DECIMAL(6, 5),
                allowNull: false,
                defaultValue: 0,
            });
        }

        // Add commissionCents (absolute cents for this line)
        if (!describe.commissionCents) {
            await queryInterface.addColumn(table, 'commissionCents', {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            });
        }
    },

    async down(queryInterface /*, Sequelize */) {
        const table = 'order_items';
        const describe = await queryInterface.describeTable(table);

        if (describe.commissionCents) {
            await queryInterface.removeColumn(table, 'commissionCents');
        }
        if (describe.commissionPct) {
            await queryInterface.removeColumn(table, 'commissionPct');
        }
    },
};
