// migrations/20250923140800-sync-shipping-rules-schema.cjs

/** @type {import('sequelize').QueryInterface} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const t = await queryInterface.sequelize.transaction();
        try {
            const DIALECT = queryInterface.sequelize.getDialect();
            const isPg = DIALECT === 'postgres';
            const table = 'shipping_rules';

            // ----- table exists?
            const tablesRaw = await queryInterface.showAllTables({ transaction: t });
            const tables = (Array.isArray(tablesRaw) ? tablesRaw : []).map((v) =>
                typeof v === 'string' ? v.replace(/^public\./i, '').toLowerCase() : String(v)
            );
            const hasTable = tables.includes(table);

            // ----- current columns (empty if table doesn't exist)
            const describe = hasTable
                ? await queryInterface.describeTable(table, { transaction: t })
                : {};

            const hasCol = (name) => Object.hasOwn(describe, name);

            // ----- create table if missing
            if (!hasTable) {
                await queryInterface.createTable(
                    table,
                    {
                        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },

                        // null → global default; otherwise applies to a specific vendor
                        vendorId: { type: Sequelize.BIGINT, allowNull: true },

                        // human readable label
                        label: { type: Sequelize.STRING(120), allowNull: false, defaultValue: 'Shipping' },

                        // one (at most) active per scope
                        isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

                        // price components
                        baseCents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                        perItemCents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                        freeThresholdCents: { type: Sequelize.INTEGER, allowNull: true },

                        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
                        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
                    },
                    { transaction: t }
                );
            }

            // ----- add any missing columns (idempotent)
            const addColumnIfMissing = async (name, spec) => {
                if (!hasCol(name)) {
                    await queryInterface.addColumn(table, name, spec, { transaction: t });
                }
            };

            await addColumnIfMissing('vendorId', { type: Sequelize.BIGINT, allowNull: true });
            await addColumnIfMissing('label', { type: Sequelize.STRING(120), allowNull: false, defaultValue: 'Shipping' });
            await addColumnIfMissing('isActive', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });

            await addColumnIfMissing('baseCents', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
            await addColumnIfMissing('perItemCents', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
            await addColumnIfMissing('freeThresholdCents', { type: Sequelize.INTEGER, allowNull: true });

            await addColumnIfMissing('createdAt', { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') });
            await addColumnIfMissing('updatedAt', { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') });

            // ----- index helpers
            const indexExists = async (name) => {
                if (!isPg) return false;
                const [rows] = await queryInterface.sequelize.query(
                    `SELECT 1 FROM pg_indexes WHERE schemaname = ANY (current_schemas(false)) AND indexname = :name`,
                    { transaction: t, replacements: { name } }
                );
                return Array.isArray(rows) && rows.length > 0;
            };

            const ensureIndex = async (name, fields, opts = {}) => {
                if (isPg) {
                    if (!(await indexExists(name))) {
                        await queryInterface.addIndex(table, fields, { name, ...opts, transaction: t });
                    }
                } else {
                    // best-effort for other dialects
                    try {
                        await queryInterface.addIndex(table, fields, { name, ...opts, transaction: t });
                    } catch {
                        // ignore if already exists
                    }
                }
            };

            // indexes to match model
            await ensureIndex('shipping_rules_vendorId_idx', ['vendorId']);
            await ensureIndex('shipping_rules_isActive_idx', ['isActive']);
            await ensureIndex('shipping_rules_vendor_active_idx', ['vendorId', 'isActive']);

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },

    async down(queryInterface, _Sequelize) {
        // Idempotent "sync" migration: do not drop the table on down.
        const t = await queryInterface.sequelize.transaction();
        try {
            const DIALECT = queryInterface.sequelize.getDialect();
            const isPg = DIALECT === 'postgres';
            const table = 'shipping_rules';

            const dropIndexIfExists = async (name) => {
                if (isPg) {
                    const [rows] = await queryInterface.sequelize.query(
                        `SELECT 1 FROM pg_indexes WHERE schemaname = ANY (current_schemas(false)) AND indexname = :name`,
                        { transaction: t, replacements: { name } }
                    );
                    if (Array.isArray(rows) && rows.length > 0) {
                        await queryInterface.removeIndex(table, name, { transaction: t });
                    }
                } else {
                    try {
                        await queryInterface.removeIndex(table, name, { transaction: t });
                    } catch {
                        // ignore
                    }
                }
            };

            await dropIndexIfExists('shipping_rules_vendorId_idx');
            await dropIndexIfExists('shipping_rules_isActive_idx');
            await dropIndexIfExists('shipping_rules_vendor_active_idx');

            // Keep table and columns intact (sync migration).
            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },
};
