'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(q) {
        await q.createTable('carts', {
            id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
            userId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
        });
    },
    async down(q) {
        await q.dropTable('carts');
    },
};
