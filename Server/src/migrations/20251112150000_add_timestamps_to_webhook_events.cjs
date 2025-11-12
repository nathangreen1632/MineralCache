'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const table = 'webhook_events';
        await queryInterface.addColumn(table, 'createdAt', {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('NOW()'),
        });
        await queryInterface.addColumn(table, 'updatedAt', {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('NOW()'),
        });
    },

    async down(queryInterface) {
        const table = 'webhook_events';
        await queryInterface.removeColumn(table, 'updatedAt');
        await queryInterface.removeColumn(table, 'createdAt');
    },
};
