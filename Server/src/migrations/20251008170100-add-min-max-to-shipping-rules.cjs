'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const t = await queryInterface.sequelize.transaction();
        try {
            const table = 'shipping_rules';
            const desc = await queryInterface.describeTable(table);

            if (!desc.minCents) {
                await queryInterface.addColumn(
                    table,
                    'minCents',
                    { type: Sequelize.INTEGER, allowNull: true },
                    { transaction: t }
                );
            }

            if (!desc.maxCents) {
                await queryInterface.addColumn(
                    table,
                    'maxCents',
                    { type: Sequelize.INTEGER, allowNull: true },
                    { transaction: t }
                );
            }

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },

    async down(queryInterface) {
        const t = await queryInterface.sequelize.transaction();
        try {
            const table = 'shipping_rules';
            const desc = await queryInterface.describeTable(table);

            if (desc.maxCents) {
                await queryInterface.removeColumn(table, 'maxCents', { transaction: t });
            }
            if (desc.minCents) {
                await queryInterface.removeColumn(table, 'minCents', { transaction: t });
            }

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },
};
