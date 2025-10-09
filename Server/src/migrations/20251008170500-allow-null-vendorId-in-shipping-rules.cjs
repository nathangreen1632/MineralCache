'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Allow NULL so we can have a global default rule (vendorId = NULL)
        await queryInterface.changeColumn('shipping_rules', 'vendorId', {
            type: Sequelize.BIGINT,
            allowNull: true,
        });
    },

    async down(queryInterface, Sequelize) {
        // Revert to NOT NULL (only if you’re sure no NULL rows remain)
        await queryInterface.sequelize.transaction(async (t) => {
            // Optional safety: delete any global rows before forcing NOT NULL
            // await queryInterface.sequelize.query(
            //   'DELETE FROM "shipping_rules" WHERE "vendorId" IS NULL',
            //   { transaction: t }
            // );

            await queryInterface.changeColumn('shipping_rules', 'vendorId', {
                type: Sequelize.BIGINT,
                allowNull: false,
            }, { transaction: t });
        });
    },
};
