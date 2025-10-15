'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('user_agreements', {
            id: {
                type: Sequelize.BIGINT,
                primaryKey: true,
                autoIncrement: true,
            },
            userId: {
                type: Sequelize.BIGINT,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'RESTRICT',
                onUpdate: 'CASCADE',
            },
            documentType: {
                type: Sequelize.STRING(64),
                allowNull: false,
            },
            version: {
                type: Sequelize.STRING(32),
                allowNull: false,
            },
            acceptedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW'),
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW'),
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW'),
            },
        });

        await queryInterface.addIndex('user_agreements', ['userId'], {
            name: 'idx_user_agreements_userId',
        });

        await queryInterface.addConstraint('user_agreements', {
            type: 'unique',
            fields: ['userId', 'documentType', 'version'],
            name: 'uniq_user_agreements_user_doc_ver',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('user_agreements');
    },
};
