'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(q) {
        await q.createTable('bids', {
            id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
            auctionId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'auctions', key: 'id' },
                onDelete: 'CASCADE',
            },
            bidderUserId: {
                type: DataTypes.BIGINT,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            maxProxyCents: { type: DataTypes.INTEGER, allowNull: false },
            effectiveBidCents: { type: DataTypes.INTEGER, allowNull: false },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
        });

        await q.addIndex('bids', ['auctionId','createdAt'], { name: 'bids_auction_created_idx' });
    },
    async down(q) {
        await q.removeIndex('bids', 'bids_auction_created_idx').catch(() => {});
        await q.dropTable('bids');
    },
};
