/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const t = await queryInterface.sequelize.transaction();
        try {
            // Ensure columns exist (idempotent)
            const addColIfMissing = async (table, column, spec) => {
                const desc = await queryInterface.describeTable(table, { transaction: t });
                if (!desc[column]) {
                    await queryInterface.addColumn(table, column, spec, { transaction: t });
                }
            };

            await addColIfMissing('shipping_rules', 'active', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: 'Whether this rule can be selected',
            });

            await addColIfMissing('shipping_rules', 'is_default_global', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'If true, this is the global default rule',
            });

            await addColIfMissing('shipping_rules', 'priority', {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 100,
                comment: 'Lower goes first during selection',
            });

            // Detect how the vendor column is named (or if it exists at all)
            const desc = await queryInterface.describeTable('shipping_rules', { transaction: t });
            const hasVendorIdSnake = !!desc.vendor_id;
            const hasVendorIdCamel = !!desc.vendorId;
            const vendorCol = hasVendorIdSnake ? '"vendor_id"' : (hasVendorIdCamel ? '"vendorId"' : null);

            // Create partial unique indexes instead of a composite constraint.
            // 1) Only ONE global default where vendor IS NULL.
            await queryInterface.sequelize.query(
                `
        CREATE UNIQUE INDEX IF NOT EXISTS shipping_rules_one_global_default_unique
        ON public.shipping_rules ((is_default_global))
        WHERE is_default_global IS TRUE ${vendorCol ? `AND ${vendorCol} IS NULL` : ''};
        `,
                { transaction: t }
            );

            // 2) Only ONE vendor default per vendor (if vendor column exists).
            if (vendorCol) {
                await queryInterface.sequelize.query(
                    `
          CREATE UNIQUE INDEX IF NOT EXISTS shipping_rules_one_vendor_default_unique
          ON public.shipping_rules (${vendorCol})
          WHERE is_default_global IS TRUE;
          `,
                    { transaction: t }
                );
            }

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },

    async down(queryInterface /* , Sequelize */) {
        const t = await queryInterface.sequelize.transaction();
        try {
            // Drop the indexes if present; leave columns in place (they're safe).
            await queryInterface.sequelize.query(
                `DROP INDEX IF EXISTS shipping_rules_one_global_default_unique;`,
                { transaction: t }
            );
            await queryInterface.sequelize.query(
                `DROP INDEX IF EXISTS shipping_rules_one_vendor_default_unique;`,
                { transaction: t }
            );

            // Optionally remove the columns (commented out to keep data).
            // await queryInterface.removeColumn('shipping_rules', 'priority', { transaction: t });
            // await queryInterface.removeColumn('shipping_rules', 'is_default_global', { transaction: t });
            // await queryInterface.removeColumn('shipping_rules', 'active', { transaction: t });

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },
};
