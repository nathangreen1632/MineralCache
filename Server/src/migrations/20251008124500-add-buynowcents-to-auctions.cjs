'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(q, Sequelize) {
        const desc = await q.describeTable('auctions').catch(() => null);
        if (!desc) {
            throw new Error('Table "auctions" does not exist. Run base schema migrations first.');
        }

        const hasCamel = !!desc.buyNowCents;
        const hasSnake = !!desc.buy_now_cents;

        if (!hasCamel) {
            if (hasSnake) {
                await q.renameColumn('auctions', 'buy_now_cents', 'buyNowCents');
            } else {
                await q.addColumn('auctions', 'buyNowCents', { type: Sequelize.INTEGER, allowNull: true });
            }
        }
    },

    async down(q) {
        const desc = await q.describeTable('auctions').catch(() => null);
        if (!desc) return;
        if (desc.buyNowCents) {
            await q.removeColumn('auctions', 'buyNowCents').catch(() => {});
        }
    },
};
