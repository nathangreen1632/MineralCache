'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(q) {
        await q.createTable('order_vendor', {
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
            itemsSubtotalCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
            shippingCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

            commissionPct: { type: DataTypes.DECIMAL(5,4), allowNull: false },     // effective
            commissionMinCents: { type: DataTypes.INTEGER, allowNull: false },     // effective
            commissionFeeCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // actual fee captured

            transferId: { type: DataTypes.STRING(120), allowNull: true },
            payoutStatus: { type: DataTypes.ENUM('pending','holding','transferred','reversed'), allowNull: false, defaultValue: 'pending' },

            shippedAt: { type: DataTypes.DATE, allowNull: true },
            deliveredAt: { type: DataTypes.DATE, allowNull: true },
            holdUntil: { type: DataTypes.DATE, allowNull: true },

            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
        });

        await q.addIndex('order_vendor', ['payoutStatus','holdUntil'], { name: 'order_vendor_payout_hold_idx' });
    },
    async down(q) {
        await q.removeIndex('order_vendor', 'order_vendor_payout_hold_idx').catch(() => {});
        await q.dropTable('order_vendor');
    },
};
