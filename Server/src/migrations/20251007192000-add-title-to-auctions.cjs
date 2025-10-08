'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(q, Sequelize) {
        const desc = await q.describeTable('auctions').catch(() => null);
        if (!desc) {
            throw new Error('Table "auctions" does not exist. Run base schema migrations first.');
        }

        // Add 'title' if missing; use varchar(120) per ERD
        if (!desc.title) {
            await q.addColumn('auctions', 'title', {
                type: Sequelize.STRING(120),
                allowNull: false,
                defaultValue: 'Untitled Auction',
            });
        }

        // Helpful indexes (no-ops if already present)
        await q.addIndex('auctions', ['status', 'endAt']).catch(() => {});
        await q
            .addIndex('auctions', ['vendorId', 'status', 'endAt'], {
                name: 'auctions_vendor_status_end_idx',
            })
            .catch(() => {});
    },

    async down(q) {
        const desc = await q.describeTable('auctions').catch(() => null);
        if (desc && desc.title) {
            await q.removeColumn('auctions', 'title').catch(() => {});
        }
    },
};
