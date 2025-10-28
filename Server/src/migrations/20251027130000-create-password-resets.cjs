'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('password_resets', {
            id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
            userId: {
                type: Sequelize.BIGINT,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            codeHash: { type: Sequelize.STRING(120), allowNull: false },
            expiresAt: { type: Sequelize.DATE, allowNull: false },
            usedAt: { type: Sequelize.DATE, allowNull: true },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.addIndex('password_resets', ['userId']);
        await queryInterface.addIndex('password_resets', ['expiresAt']);
        await queryInterface.addIndex('password_resets', ['usedAt']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('password_resets');
    },
};
