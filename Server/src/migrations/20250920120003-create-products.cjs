'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(q) {
        await q.createTable('products', {
            id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
            vendorId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'vendors', key: 'id' },
                onDelete: 'CASCADE',
            },
            title: { type: DataTypes.STRING(200), allowNull: false },
            description: { type: DataTypes.TEXT, allowNull: true },

            species: { type: DataTypes.STRING(120), allowNull: false },
            locality: { type: DataTypes.STRING(200), allowNull: false },
            sizeCm: { type: DataTypes.DECIMAL(6,2), allowNull: true },
            weightG: { type: DataTypes.DECIMAL(8,2), allowNull: true },
            fluorescence: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
            condition: { type: DataTypes.STRING(120), allowNull: true },
            provenance: { type: DataTypes.STRING(240), allowNull: true },
            synthetic: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

            priceCents: { type: DataTypes.INTEGER, allowNull: false },
            salePriceCents: { type: DataTypes.INTEGER, allowNull: true },
            saleStartAt: { type: DataTypes.DATE, allowNull: true },
            saleEndAt: { type: DataTypes.DATE, allowNull: true },

            qty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
            status: { type: DataTypes.ENUM('draft','active','archived'), allowNull: false, defaultValue: 'draft' },

            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
        });

        await q.addIndex('products', ['status','species','locality','priceCents'], {
            name: 'products_status_species_locality_price_idx',
        });
    },
    async down(q) {
        await q.removeIndex('products', 'products_status_species_locality_price_idx').catch(() => {});
        await q.dropTable('products');
    },
};
