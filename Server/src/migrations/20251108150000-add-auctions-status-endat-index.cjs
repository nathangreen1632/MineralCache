'use strict';

module.exports = {
    async up(q, Sequelize) {
        const indexes = await q.showIndex('auctions').catch(() => []);
        const has = Array.isArray(indexes) && indexes.some(ix => ix.name === 'auctions_status_endAt_idx');
        if (!has) {
            await q.addIndex('auctions', ['status', 'endAt'], {
                name: 'auctions_status_endAt_idx',
            });
        }
    },

    async down(q, Sequelize) {
        try {
            await q.removeIndex('auctions', 'auctions_status_endAt_idx');
        } catch {}
    },
};
