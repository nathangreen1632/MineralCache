'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(q) {
        await q.createTable('vendors', {
            id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
            userId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            displayName: { type: DataTypes.STRING(120), allowNull: false, unique: true },
            slug: { type: DataTypes.STRING(140), allowNull: false, unique: true },
            bio: { type: DataTypes.TEXT, allowNull: true },
            logoUrl: { type: DataTypes.STRING(500), allowNull: true },
            country: { type: DataTypes.STRING(2), allowNull: true },
            approvalStatus: { type: DataTypes.ENUM('pending','approved','rejected'), allowNull: false, defaultValue: 'pending' },
            stripeAccountId: { type: DataTypes.STRING(120), allowNull: true },
            commissionOverridePct: { type: DataTypes.DECIMAL(5,4), allowNull: true }, // e.g. 0.0800
            minFeeOverrideCents: { type: DataTypes.INTEGER, allowNull: true },
            newVendorCompletedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
        });
    },
    async down(q) {
        await q.dropTable('vendors');
    },
};
