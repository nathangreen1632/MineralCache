// Server/src/migrations/20250928140500-order-items-fulfillment.cjs
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const table = 'order_items';
        const desc = await queryInterface.describeTable(table);

        if (!desc.ship_carrier) {
            await queryInterface.addColumn(table, 'ship_carrier', {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }
        if (!desc.ship_tracking) {
            await queryInterface.addColumn(table, 'ship_tracking', {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }
        if (!desc.shipped_at) {
            await queryInterface.addColumn(table, 'shipped_at', {
                type: Sequelize.DATE,
                allowNull: true,
            });
        }
        if (!desc.delivered_at) {
            await queryInterface.addColumn(table, 'delivered_at', {
                type: Sequelize.DATE,
                allowNull: true,
            });
        }
    },

    async down(queryInterface) {
        const table = 'order_items';
        const desc = await queryInterface.describeTable(table);

        if (desc.delivered_at) await queryInterface.removeColumn(table, 'delivered_at');
        if (desc.shipped_at) await queryInterface.removeColumn(table, 'shipped_at');
        if (desc.ship_tracking) await queryInterface.removeColumn(table, 'ship_tracking');
        if (desc.ship_carrier) await queryInterface.removeColumn(table, 'ship_carrier');
    },
};
