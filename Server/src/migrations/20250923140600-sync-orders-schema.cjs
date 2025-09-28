// migrations/20250923140600-sync-orders-schema.cjs
/** @type {import('sequelize').QueryInterface} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const t = await queryInterface.sequelize.transaction();
        try {
            const DIALECT = queryInterface.sequelize.getDialect();
            const isPg = DIALECT === 'postgres';
            const table = 'orders';

            // Helper: table exists?
            const tablesRaw = await queryInterface.showAllTables({ transaction: t });
            const tables = (Array.isArray(tablesRaw) ? tablesRaw : []).map((v) =>
                typeof v === 'string' ? v.replace(/^public\./i, '').toLowerCase() : String(v)
            );
            const hasTable = tables.includes(table);

            // Helper: describe columns (empty object if table missing)
            const describe = hasTable
                ? await queryInterface.describeTable(table, { transaction: t })
                : {};

            const hasCol = (name) => Object.hasOwn(describe, name);

            // ---------- Ensure ENUM type (Postgres)
            if (isPg) {
                // This matches Sequelize's default type name for the model/attr
                await queryInterface.sequelize.query(
                    `DO $$
           BEGIN
             IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_${table}_status') THEN
               CREATE TYPE "enum_${table}_status" AS ENUM ('pending_payment', 'paid', 'failed', 'refunded');
             END IF;
           END $$;`,
                    { transaction: t }
                );
            }

            // ---------- Create table if missing
            if (!hasTable) {
                await queryInterface.createTable(
                    table,
                    {
                        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
                        buyerUserId: { type: Sequelize.BIGINT, allowNull: false },

                        status: isPg
                            ? { type: Sequelize.ENUM('pending_payment', 'paid', 'failed', 'refunded'), allowNull: false, defaultValue: 'pending_payment' }
                            : { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'pending_payment' },

                        paymentIntentId: { type: Sequelize.STRING(200), allowNull: true },

                        subtotalCents: { type: Sequelize.INTEGER, allowNull: false },
                        shippingCents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                        totalCents: { type: Sequelize.INTEGER, allowNull: false },

                        commissionPct: { type: Sequelize.DECIMAL(6, 4), allowNull: false, defaultValue: 0.08 },
                        commissionCents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

                        vendorShippingJson: isPg ? { type: Sequelize.JSONB, allowNull: true } : { type: Sequelize.JSON, allowNull: true },

                        paidAt: { type: Sequelize.DATE, allowNull: true },
                        failedAt: { type: Sequelize.DATE, allowNull: true },
                        refundedAt: { type: Sequelize.DATE, allowNull: true },

                        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
                        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
                    },
                    { transaction: t }
                );
            }

            // ---------- Add missing columns if table already existed
            const addColumnIfMissing = async (name, spec) => {
                if (!hasCol(name)) {
                    await queryInterface.addColumn(table, name, spec, { transaction: t });
                }
            };

            await addColumnIfMissing('buyerUserId', { type: Sequelize.BIGINT, allowNull: false });

            await addColumnIfMissing(
                'status',
                isPg
                    ? { type: Sequelize.ENUM('pending_payment', 'paid', 'failed', 'refunded'), allowNull: false, defaultValue: 'pending_payment' }
                    : { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'pending_payment' }
            );

            await addColumnIfMissing('paymentIntentId', { type: Sequelize.STRING(200), allowNull: true });

            await addColumnIfMissing('subtotalCents', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
            await addColumnIfMissing('shippingCents', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
            await addColumnIfMissing('totalCents', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });

            await addColumnIfMissing('commissionPct', { type: Sequelize.DECIMAL(6, 4), allowNull: false, defaultValue: 0.08 });
            await addColumnIfMissing('commissionCents', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });

            await addColumnIfMissing(
                'vendorShippingJson',
                isPg ? { type: Sequelize.JSONB, allowNull: true } : { type: Sequelize.JSON, allowNull: true }
            );

            await addColumnIfMissing('paidAt', { type: Sequelize.DATE, allowNull: true });
            await addColumnIfMissing('failedAt', { type: Sequelize.DATE, allowNull: true });
            await addColumnIfMissing('refundedAt', { type: Sequelize.DATE, allowNull: true });

            await addColumnIfMissing('createdAt', { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') });
            await addColumnIfMissing('updatedAt', { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') });

            // ---------- Index helpers
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
                    // Best effort for other dialects
                    await queryInterface.addIndex(table, fields, { name, ...opts, transaction: t });
                }
            };

            // Unique on paymentIntentId
            await ensureIndex('orders_paymentIntentId_unique', ['paymentIntentId'], { unique: true });

            // Singles
            await ensureIndex('orders_buyerUserId_idx', ['buyerUserId']);
            await ensureIndex('orders_status_idx', ['status']);
            await ensureIndex('orders_createdAt_idx', ['createdAt']);

            // Composite buyer + created
            await ensureIndex('orders_buyer_created_idx', ['buyerUserId', 'createdAt']);

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },

    async down(queryInterface, Sequelize) {
        const t = await queryInterface.sequelize.transaction();
        try {
            const DIALECT = queryInterface.sequelize.getDialect();
            const isPg = DIALECT === 'postgres';
            const table = 'orders';

            const tablesRaw = await queryInterface.showAllTables({ transaction: t });
            const tables = (Array.isArray(tablesRaw) ? tablesRaw : []).map((v) =>
                typeof v === 'string' ? v.replace(/^public\./i, '').toLowerCase() : String(v)
            );
            const hasTable = tables.includes(table);

            if (hasTable) {
                // Drop indexes added by this migration (if present)
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

                await dropIndexIfExists('orders_paymentIntentId_unique');
                await dropIndexIfExists('orders_buyerUserId_idx');
                await dropIndexIfExists('orders_status_idx');
                await dropIndexIfExists('orders_createdAt_idx');
                await dropIndexIfExists('orders_buyer_created_idx');

                // Do not drop table; this migration is a sync.
                // If you really need to revert columns, do so selectively here.
            }

            // Do not drop enum type on down to avoid breaking older rows.
            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },
};
