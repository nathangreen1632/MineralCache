'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(q) {
        await q.createTable('ledger', {
            id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
            orderVendorId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'order_vendor', key: 'id' },
                onDelete: 'CASCADE',
            },
            type: { type: DataTypes.ENUM('charge','transfer','reverse_transfer','refund','fee'), allowNull: false },
            amountCents: { type: DataTypes.INTEGER, allowNull: false },
            stripeRef: { type: DataTypes.STRING(180), allowNull: true },
            notes: { type: DataTypes.TEXT, allowNull: true },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
        });
    },
    async down(q) {
        await q.dropTable('ledger');
    },
};
