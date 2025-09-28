'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const exists = await queryInterface.describeTable('auctions').catch(() => null);
        if (exists) return;

        await queryInterface.createTable('auctions', {
            id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
            productId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'products', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
            },
            vendorId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'vendors', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
            },
            title: { type: Sequelize.STRING(200), allowNull: false },
            status: {
                type: Sequelize.ENUM('draft', 'scheduled', 'live', 'ended', 'canceled'),
                allowNull: false,
                defaultValue: 'draft',
            },
            startAt: { type: Sequelize.DATE, allowNull: true },
            endAt: { type: Sequelize.DATE, allowNull: true },
            startingBidCents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            reserveCents: { type: Sequelize.INTEGER, allowNull: true },
            incrementLadderJson: { type: Sequelize.JSONB, allowNull: true },
            highBidCents: { type: Sequelize.INTEGER, allowNull: true },
            highBidUserId: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
            },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.addIndex('auctions', ['vendorId', 'status', 'endAt'], { name: 'auctions_vendor_status_end_idx' });
        await queryInterface.addIndex('auctions', ['productId'], { name: 'auctions_product_idx' });
        await queryInterface.addIndex('auctions', ['status', 'endAt'], { name: 'auctions_status_end_idx' });
    },

    async down(queryInterface, Sequelize) {
        // keep ENUM tidy
        await queryInterface.dropTable('auctions').catch(() => {});
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_auctions_status";').catch(() => {});
    },
};
