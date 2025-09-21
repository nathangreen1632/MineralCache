'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(q) {
        await q.createTable('order_items', {
            id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
            orderId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'orders', key: 'id' },
                onDelete: 'CASCADE',
            },
            vendorId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'vendors', key: 'id' },
                onDelete: 'RESTRICT',
            },
            productId: { type: DataTypes.BIGINT, allowNull: true },
            auctionId: { type: DataTypes.BIGINT, allowNull: true },
            titleSnapshot: { type: DataTypes.STRING(240), allowNull: false },
            qty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
            unitPriceCents: { type: DataTypes.INTEGER, allowNull: false },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
        });
    },
    async down(q) {
        await q.dropTable('order_items');
    },
};
