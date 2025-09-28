'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface /*, Sequelize */) {
        const table = 'order_items';

        const existing = await queryInterface.showIndex(table);
        const names = new Set(existing.map((i) => i.name));

        // Single-column index to speed up WHERE vendorId = ?
        if (!names.has('order_items_vendor_idx')) {
            await queryInterface.addIndex(table, ['vendorId'], {
                name: 'order_items_vendor_idx',
            });
        }

        // Composite index to help vendor lists ordered by recency
        if (!names.has('order_items_vendor_created_idx')) {
            await queryInterface.addIndex(table, ['vendorId', 'createdAt'], {
                name: 'order_items_vendor_created_idx',
            });
        }
    },

    async down(queryInterface /*, Sequelize */) {
        const table = 'order_items';

        const existing = await queryInterface.showIndex(table);
        const names = new Set(existing.map((i) => i.name));

        if (names.has('order_items_vendor_created_idx')) {
            await queryInterface.removeIndex(table, 'order_items_vendor_created_idx');
        }
        if (names.has('order_items_vendor_idx')) {
            await queryInterface.removeIndex(table, 'order_items_vendor_idx');
        }
    },
};
