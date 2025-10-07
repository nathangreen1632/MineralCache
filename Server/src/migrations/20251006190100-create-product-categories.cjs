'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(q) {
        await q.createTable('product_categories', {
            productId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'products', key: 'id' },
                onDelete: 'CASCADE',
            },
            categoryId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'categories', key: 'id' },
                onDelete: 'RESTRICT',
            },
        });

        await q.addConstraint('product_categories', {
            type: 'unique',
            name: 'uniq_product_category_pair',
            fields: ['productId', 'categoryId'],
        });

        // Enforce "exactly one category per product" for now (easy to remove later)
        await q.addConstraint('product_categories', {
            type: 'unique',
            name: 'uniq_product_category_once',
            fields: ['productId'],
        });

        await q.addIndex('product_categories', ['categoryId']);
    },

    async down(q) {
        await q.dropTable('product_categories');
    },
};
