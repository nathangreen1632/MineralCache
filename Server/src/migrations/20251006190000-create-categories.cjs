'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(q) {
        await q.createTable('categories', {
            id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
            name: { type: DataTypes.STRING(120), allowNull: false },
            slug: { type: DataTypes.STRING(120), allowNull: false, unique: true },
            active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            homeOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
            imageKey: { type: DataTypes.STRING(255), allowNull: true },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
        });
        await q.addIndex('categories', ['active']);
        await q.addIndex('categories', ['homeOrder']);
    },

    async down(q) {
        await q.dropTable('categories');
    },
};
