/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(q) {
        const [rows] = await q.sequelize.query(`
      SELECT table_name, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'status'
        AND table_name IN ('auctions','auction_locks')
      ORDER BY table_name;
    `);

        const types = Object.fromEntries(rows.map(r => [r.table_name, r.udt_name]));
        const aucType = types.auctions || 'enum_auctions_status';
        const lockType = types.auction_locks || 'enum_auction_locks_status';

        await q.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_auctions_active_per_product
      ON auctions ("productId")
      WHERE "status" IN ('scheduled'::${aucType}, 'live'::${aucType});
    `);

        await q.sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_auction_locks_active_product
                ON auction_locks ("productId")
                WHERE "status" = 'active'::${lockType};
        `);
    },

    async down(q) {
        await q.sequelize.query(`DROP INDEX IF EXISTS uq_auction_locks_active_product;`);
        await q.sequelize.query(`DROP INDEX IF EXISTS uq_auctions_active_per_product;`);
    },
};
