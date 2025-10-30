'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const t = await queryInterface.sequelize.transaction();
        try {
            const table = 'order_items';
            const desc = await queryInterface.describeTable(table, { transaction: t });
            const has = (c) => Object.hasOwn(desc, c);

            // Ensure modern columns exist (idempotent safety)
            if (!has('title')) {
                await queryInterface.addColumn(
                    table,
                    'title',
                    { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
                    { transaction: t }
                );
            }
            if (!has('quantity')) {
                await queryInterface.addColumn(
                    table,
                    'quantity',
                    { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
                    { transaction: t }
                );
            }
            if (!has('unitPriceCents')) {
                await queryInterface.addColumn(
                    table,
                    'unitPriceCents',
                    { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                    { transaction: t }
                );
            }
            if (!has('lineTotalCents')) {
                await queryInterface.addColumn(
                    table,
                    'lineTotalCents',
                    { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                    { transaction: t }
                );
            }

            // Backfill modern columns from legacy ones if necessary
            if (has('titleSnapshot')) {
                await queryInterface.sequelize.query(
                    `UPDATE "order_items" SET "title" = COALESCE(NULLIF("title", ''), "titleSnapshot")`,
                    { transaction: t }
                );
            }
            if (has('qty')) {
                await queryInterface.sequelize.query(
                    `UPDATE "order_items" SET "quantity" = COALESCE("quantity", "qty")`,
                    { transaction: t }
                );
            }

            // Tighten NOT NULL after backfill
            await queryInterface.changeColumn(
                table,
                'title',
                { type: Sequelize.TEXT, allowNull: false },
                { transaction: t }
            );
            await queryInterface.changeColumn(
                table,
                'quantity',
                { type: Sequelize.INTEGER, allowNull: false },
                { transaction: t }
            );
            await queryInterface.changeColumn(
                table,
                'unitPriceCents',
                { type: Sequelize.INTEGER, allowNull: false },
                { transaction: t }
            );
            await queryInterface.changeColumn(
                table,
                'lineTotalCents',
                { type: Sequelize.INTEGER, allowNull: false },
                { transaction: t }
            );

            // Drop legacy columns
            if (has('titleSnapshot')) {
                await queryInterface.removeColumn(table, 'titleSnapshot', { transaction: t });
            }
            if (has('qty')) {
                await queryInterface.removeColumn(table, 'qty', { transaction: t });
            }

            await t.commit();
        } catch (e) {
            await t.rollback();
            throw e;
        }
    },

    async down() {
        // no-op (forward-only)
    },
};
