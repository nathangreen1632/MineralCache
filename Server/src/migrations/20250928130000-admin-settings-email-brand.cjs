'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const table = 'admin_settings';
        const desc = await queryInterface.describeTable(table);

        if (!desc.email_from) {
            await queryInterface.addColumn(table, 'email_from', {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }
        if (!desc.brand_name) {
            await queryInterface.addColumn(table, 'brand_name', {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }
    },

    async down(queryInterface) {
        const table = 'admin_settings';
        const desc = await queryInterface.describeTable(table);

        if (desc.brand_name) {
            await queryInterface.removeColumn(table, 'brand_name');
        }
        if (desc.email_from) {
            await queryInterface.removeColumn(table, 'email_from');
        }
    },
};
