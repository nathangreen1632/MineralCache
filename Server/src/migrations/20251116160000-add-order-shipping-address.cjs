'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const table = 'orders';
        const cols = await queryInterface.describeTable(table).catch(() => ({}));

        if (!cols.shippingName) {
            await queryInterface.addColumn(table, 'shippingName', {
                type: Sequelize.STRING(200),
                allowNull: true,
            });
        }
        if (!cols.shippingEmail) {
            await queryInterface.addColumn(table, 'shippingEmail', {
                type: Sequelize.STRING(320),
                allowNull: true,
            });
        }
        if (!cols.shippingPhone) {
            await queryInterface.addColumn(table, 'shippingPhone', {
                type: Sequelize.STRING(50),
                allowNull: true,
            });
        }
        if (!cols.shippingAddress1) {
            await queryInterface.addColumn(table, 'shippingAddress1', {
                type: Sequelize.STRING(200),
                allowNull: true,
            });
        }
        if (!cols.shippingAddress2) {
            await queryInterface.addColumn(table, 'shippingAddress2', {
                type: Sequelize.STRING(200),
                allowNull: true,
            });
        }
        if (!cols.shippingCity) {
            await queryInterface.addColumn(table, 'shippingCity', {
                type: Sequelize.STRING(120),
                allowNull: true,
            });
        }
        if (!cols.shippingState) {
            await queryInterface.addColumn(table, 'shippingState', {
                type: Sequelize.STRING(120),
                allowNull: true,
            });
        }
        if (!cols.shippingPostal) {
            await queryInterface.addColumn(table, 'shippingPostal', {
                type: Sequelize.STRING(40),
                allowNull: true,
            });
        }
        if (!cols.shippingCountry) {
            await queryInterface.addColumn(table, 'shippingCountry', {
                type: Sequelize.STRING(2),
                allowNull: true,
            });
        }
    },

    async down(queryInterface) {
        const table = 'orders';
        const cols = await queryInterface.describeTable(table).catch(() => ({}));

        if (cols.shippingName) {
            await queryInterface.removeColumn(table, 'shippingName').catch(() => {});
        }
        if (cols.shippingEmail) {
            await queryInterface.removeColumn(table, 'shippingEmail').catch(() => {});
        }
        if (cols.shippingPhone) {
            await queryInterface.removeColumn(table, 'shippingPhone').catch(() => {});
        }
        if (cols.shippingAddress1) {
            await queryInterface.removeColumn(table, 'shippingAddress1').catch(() => {});
        }
        if (cols.shippingAddress2) {
            await queryInterface.removeColumn(table, 'shippingAddress2').catch(() => {});
        }
        if (cols.shippingCity) {
            await queryInterface.removeColumn(table, 'shippingCity').catch(() => {});
        }
        if (cols.shippingState) {
            await queryInterface.removeColumn(table, 'shippingState').catch(() => {});
        }
        if (cols.shippingPostal) {
            await queryInterface.removeColumn(table, 'shippingPostal').catch(() => {});
        }
        if (cols.shippingCountry) {
            await queryInterface.removeColumn(table, 'shippingCountry').catch(() => {});
        }
    },
};
