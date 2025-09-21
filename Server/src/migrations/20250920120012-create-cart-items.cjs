'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(q) {
        await q.createTable('cart_items', {
            id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
            cartId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'carts', key: 'id' },
                onDelete: 'CASCADE',
            },
            productId: { type: DataTypes.BIGINT, allowNull: true },
            auctionId: { type: DataTypes.BIGINT, allowNull: true },
            qty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
            unitPriceSnapshotCents: { type: DataTypes.INTEGER, allowNull: false },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
        });
    },
    async down(q) {
        await q.dropTable('cart_items');
    },
};
