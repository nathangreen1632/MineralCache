'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const exists = await queryInterface.describeTable('auction_locks').catch(() => null);
        if (exists) return;

        await queryInterface.createTable('auction_locks', {
            id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
            productId: {
                type: Sequelize.BIGINT,
                allowNull: false,
                references: { model: 'products', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
            },
            userId: {
                type: Sequelize.BIGINT,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
            },
            auctionId: {
                type: Sequelize.BIGINT,
                allowNull: false,
                references: { model: 'auctions', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            priceCents: { type: Sequelize.BIGINT, allowNull: false },
            expiresAt: { type: Sequelize.DATE, allowNull: false },
            status: {
                type: Sequelize.ENUM('active', 'paid', 'released'),
                allowNull: false,
                defaultValue: 'active',
            },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.addIndex('auction_locks', ['productId'], { name: 'auction_locks_product_idx' });
        await queryInterface.addIndex('auction_locks', ['userId'], { name: 'auction_locks_user_idx' });
        await queryInterface.addIndex('auction_locks', ['auctionId'], { name: 'auction_locks_auction_idx' });
        await queryInterface.addIndex('auction_locks', ['status'], { name: 'auction_locks_status_idx' });
        await queryInterface.addIndex('auction_locks', ['productId', 'status'], { name: 'auction_locks_product_status_idx' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('auction_locks');
    },
};
