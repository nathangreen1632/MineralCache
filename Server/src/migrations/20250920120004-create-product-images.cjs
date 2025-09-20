'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(q) {
        await q.createTable('product_images', {
            id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
            productId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'products', key: 'id' },
                onDelete: 'CASCADE',
            },
            url: { type: DataTypes.STRING(500), allowNull: false },
            w: { type: DataTypes.INTEGER, allowNull: true },
            h: { type: DataTypes.INTEGER, allowNull: true },
            sort: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
        });
    },
    async down(q) {
        await q.dropTable('product_images');
    },
};
