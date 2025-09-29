'use strict';

/** Utility: does a table exist? */
async function tableExists(qi, table) {
    const [rows] = await qi.sequelize.query(
        `SELECT to_regclass('public."${table}"') AS exists;`
    );
    return !!rows?.[0]?.exists;
}

/** Utility: get column names for a table */
async function getCols(qi, table) {
    const [rows] = await qi.sequelize.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '${table}'
  `);
    return new Set(rows.map(r => r.column_name));
}

/** Utility: add a column if it doesn't exist */
async function addColIfMissing(qi, table, colName, spec) {
    const cols = await getCols(qi, table);
    if (!cols.has(colName)) {
        await qi.addColumn(table, colName, spec);
        return true;
    }
    return false;
}

/** Utility: create an index if it doesn't exist */
async function addIndexIfMissing(qi, table, indexName, fields) {
    const [rows] = await qi.sequelize.query(`
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = '${indexName}'
  `);
    if (rows.length === 0) {
        await qi.addIndex(table, {
            name: indexName,
            fields,
        });
        return true;
    }
    return false;
}

/** Utility: drop an index if it exists */
async function dropIndexIfExists(qi, table, indexName) {
    const [rows] = await qi.sequelize.query(`
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = '${indexName}'
  `);
    if (rows.length > 0) {
        await qi.removeIndex(table, indexName);
        return true;
    }
    return false;
}

module.exports = {
    async up(queryInterface, Sequelize) {
        const qi = queryInterface;
        const table = 'order_vendor';

        const exists = await tableExists(qi, table);

        // If the table doesn't exist, create it in the repo's camelCase style
        if (!exists) {
            await qi.createTable(table, {
                id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
                orderId: { type: Sequelize.BIGINT, allowNull: false },
                vendorId: { type: Sequelize.BIGINT, allowNull: false },

                // NEW payout aggregates
                vendorGrossCents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                vendorFeeCents:   { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                vendorNetCents:   { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

                createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
                updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            });
        } else {
            // Table exists: add columns if missing (support both camel & snake)
            const cols = await getCols(qi, table);

            const hasCamel = cols.has('orderId');
            const orderCol = hasCamel ? 'orderId' : 'order_id';
            const vendorCol = hasCamel ? 'vendorId' : 'vendor_id';

            await addColIfMissing(qi, table, 'vendorGrossCents', {
                type: Sequelize.INTEGER, allowNull: false, defaultValue: 0,
            });
            await addColIfMissing(qi, table, 'vendorFeeCents', {
                type: Sequelize.INTEGER, allowNull: false, defaultValue: 0,
            });
            await addColIfMissing(qi, table, 'vendorNetCents', {
                type: Sequelize.INTEGER, allowNull: false, defaultValue: 0,
            });

            // Indexes (create on whichever naming the table uses)
            await addIndexIfMissing(qi, table, `${table}_${orderCol}`, [orderCol]);
            await addIndexIfMissing(qi, table, `${table}_${vendorCol}`, [vendorCol]);
        }

        // If we just created the table from scratch, add indexes in camelCase
        if (!exists) {
            await addIndexIfMissing(qi, table, `${table}_orderId`, ['orderId']);
            await addIndexIfMissing(qi, table, `${table}_vendorId`, ['vendorId']);
        }
    },

    async down(queryInterface/*, Sequelize*/) {
        const qi = queryInterface;
        const table = 'order_vendor';

        const exists = await tableExists(qi, table);
        if (!exists) return;

        const cols = await getCols(qi, table);
        const orderCol = cols.has('orderId') ? 'orderId' : 'order_id';
        const vendorCol = cols.has('vendorId') ? 'vendorId' : 'vendor_id';

        // Drop indexes if present
        await dropIndexIfExists(qi, table, `${table}_${orderCol}`);
        await dropIndexIfExists(qi, table, `${table}_${vendorCol}`);

        // Drop the three aggregate columns if present
        if (cols.has('vendorGrossCents')) await qi.removeColumn(table, 'vendorGrossCents');
        if (cols.has('vendorFeeCents'))   await qi.removeColumn(table, 'vendorFeeCents');
        if (cols.has('vendorNetCents'))   await qi.removeColumn(table, 'vendorNetCents');
    },
};
