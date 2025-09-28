// migrations/20250923140700-sync-order-items-schema.cjs

/** @type {import('sequelize').QueryInterface} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const t = await queryInterface.sequelize.transaction();
        try {
            const DIALECT = queryInterface.sequelize.getDialect();
            const isPg = DIALECT === 'postgres';
            const table = 'order_items';

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
                        orderId: { type: Sequelize.BIGINT, allowNull: false },
                        productId: { type: Sequelize.BIGINT, allowNull: false },
                        vendorId: { type: Sequelize.BIGINT, allowNull: false },

                        title: { type: Sequelize.TEXT, allowNull: false },
                        unitPriceCents: { type: Sequelize.INTEGER, allowNull: false },
                        quantity: { type: Sequelize.INTEGER, allowNull: false },
                        lineTotalCents: { type: Sequelize.INTEGER, allowNull: false },

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

            await addColumnIfMissing('orderId', { type: Sequelize.BIGINT, allowNull: false });
            await addColumnIfMissing('productId', { type: Sequelize.BIGINT, allowNull: false });
            await addColumnIfMissing('vendorId', { type: Sequelize.BIGINT, allowNull: false });

            await addColumnIfMissing('title', { type: Sequelize.TEXT, allowNull: false });
            await addColumnIfMissing('unitPriceCents', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
            await addColumnIfMissing('quantity', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 });
            await addColumnIfMissing('lineTotalCents', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });

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
            await ensureIndex('order_items_orderId_idx', ['orderId']);
            await ensureIndex('order_items_vendorId_idx', ['vendorId']);
            await ensureIndex('order_items_productId_idx', ['productId']);

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },

    async down(queryInterface, _Sequelize) {
        const t = await queryInterface.sequelize.transaction();
        try {
            const DIALECT = queryInterface.sequelize.getDialect();
            const isPg = DIALECT === 'postgres';
            const table = 'order_items';

            // only clean up indexes this migration may have added; do not drop table (sync migration)
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

            await dropIndexIfExists('order_items_orderId_idx');
            await dropIndexIfExists('order_items_vendorId_idx');
            await dropIndexIfExists('order_items_productId_idx');

            // Do not drop columns or table in down(); this is a schema sync.
            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },
};
