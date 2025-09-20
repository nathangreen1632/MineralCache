'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(q) {
        await q.createTable('users', {
            id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
            email: { type: DataTypes.STRING(320), allowNull: false, unique: true },
            passwordHash: { type: DataTypes.STRING(255), allowNull: false },
            role: { type: DataTypes.ENUM('buyer','vendor','admin'), allowNull: false, defaultValue: 'buyer' },
            dobVerified18: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
        });
    },
    async down(q) {
        await q.dropTable('users');
    },
};
