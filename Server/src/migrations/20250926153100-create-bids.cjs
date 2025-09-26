'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const exists = await queryInterface.describeTable('bids').catch(() => null);
        if (exists) return;

        await queryInterface.createTable('bids', {
            id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
            auctionId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'auctions', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            amountCents: { type: Sequelize.INTEGER, allowNull: false },
            maxProxyCents: { type: Sequelize.INTEGER, allowNull: true },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.addIndex('bids', ['auctionId', 'createdAt'], { name: 'bids_auction_created_idx' });
        await queryInterface.addIndex('bids', ['auctionId', 'amountCents'], { name: 'bids_auction_amount_idx' });
        await queryInterface.addIndex('bids', ['userId', 'auctionId'], { name: 'bids_user_auction_idx' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('bids').catch(() => {});
    },
};
