'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(q) {
        await q.createTable('orders', {
            id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
            userId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'RESTRICT',
            },
            paymentIntentId: { type: DataTypes.STRING(120), allowNull: true },
            subtotalCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
            taxCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
            shippingCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
            totalCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
            status: { type: DataTypes.ENUM('pending','paid','partially_refunded','refunded'), allowNull: false, defaultValue: 'pending' },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
        });
    },
    async down(q) {
        await q.dropTable('orders');
    },
};
