'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(q) {
        await q.createTable('auctions', {
            id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
            productId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'products', key: 'id' },
                onDelete: 'CASCADE',
            },
            vendorId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'vendors', key: 'id' },
                onDelete: 'RESTRICT',
            },
            startAt: { type: DataTypes.DATE, allowNull: false },
            endAt: { type: DataTypes.DATE, allowNull: false },
            status: { type: DataTypes.ENUM('scheduled','live','ended','cancelled'), allowNull: false, defaultValue: 'scheduled' },
            startPriceCents: { type: DataTypes.INTEGER, allowNull: false },
            buyItNowCents: { type: DataTypes.INTEGER, allowNull: true },
            currentPriceCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
            leadingBidderId: {
                type: DataTypes.BIGINT,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onDelete: 'SET NULL',
            },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
        });

        await q.addIndex('auctions', ['endAt'], { name: 'auctions_endAt_idx' });
    },
    async down(q) {
        await q.removeIndex('auctions', 'auctions_endAt_idx').catch(() => {});
        await q.dropTable('auctions');
    },
};
