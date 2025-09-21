'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(q) {
        await q.createTable('shipping_rules', {
            id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
            vendorId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'vendors', key: 'id' },
                onDelete: 'CASCADE',
            },
            domesticFlatCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
            perItemExtraCents: { type: DataTypes.INTEGER, allowNull: true },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
        });
    },
    async down(q) {
        await q.dropTable('shipping_rules');
    },
};
