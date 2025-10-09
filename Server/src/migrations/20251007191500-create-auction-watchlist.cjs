'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(q, Sequelize) {
        const exists = await q.describeTable('auction_watchlist').catch(() => null);
        if (exists) return;

        await q.createTable('auction_watchlist', {
            id:        { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
            auctionId: {
                type: Sequelize.BIGINT,
                allowNull: false,
                references: { model: 'auctions', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            userId: {
                type: Sequelize.BIGINT,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await q.addIndex('auction_watchlist', ['auctionId'], { name: 'aw_watch_auction_idx' });
        await q.addIndex('auction_watchlist', ['userId'],    { name: 'aw_watch_user_idx' });
        await q.addIndex('auction_watchlist', ['auctionId', 'userId'], {
            unique: true,
            name: 'aw_watch_auction_user_uc',
        });
    },

    async down(q) {
        await q.dropTable('auction_watchlist').catch(() => {});
    },
};
