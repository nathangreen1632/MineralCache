'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('order_vendor', {
            id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
            order_id: { type: Sequelize.BIGINT, allowNull: false },
            vendor_id: { type: Sequelize.BIGINT, allowNull: false },

            vendor_gross_cents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            vendor_fee_cents:   { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            vendor_net_cents:   { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.addIndex('order_vendor', ['order_id']);
        await queryInterface.addIndex('order_vendor', ['vendor_id']);
        await queryInterface.addConstraint('order_vendor', {
            fields: ['order_id', 'vendor_id'],
            type: 'unique',
            name: 'order_vendor_order_vendor_uc',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('order_vendor');
    },
};
