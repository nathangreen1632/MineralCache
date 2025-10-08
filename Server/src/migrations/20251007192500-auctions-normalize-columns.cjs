'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(q, Sequelize) {
        const desc = await q.describeTable('auctions').catch(() => null);
        if (!desc) {
            throw new Error('Table "auctions" does not exist. Run base schema migrations first.');
        }

        // helper: ensure camelCase exists; if snake_case exists, rename; else add with definition
        async function ensureColumn({ camel, snake, def }) {
            const hasCamel = !!desc[camel];
            const hasSnake = !!desc[snake];
            if (hasCamel) return;
            if (hasSnake) {
                await q.renameColumn('auctions', snake, camel);
                return;
            }
            await q.addColumn('auctions', camel, def);
        }

        // title (varchar 120)
        await ensureColumn({
            camel: 'title',
            snake: 'title',
            def: { type: Sequelize.STRING(120), allowNull: false, defaultValue: 'Untitled Auction' },
        });

        // status (enum or string)
        if (!desc.status) {
            await q.addColumn('auctions', 'status', {
                type: Sequelize.ENUM('draft', 'scheduled', 'live', 'ended', 'canceled'),
                allowNull: false,
                defaultValue: 'draft',
            });
        }

        // timestamps
        await ensureColumn({ camel: 'startAt', snake: 'start_at', def: { type: Sequelize.DATE, allowNull: true } });
        await ensureColumn({ camel: 'endAt',   snake: 'end_at',   def: { type: Sequelize.DATE, allowNull: true } });

        // pricing
        await ensureColumn({
            camel: 'startingBidCents',
            snake: 'starting_bid_cents',
            def: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        });
        await ensureColumn({
            camel: 'reserveCents',
            snake: 'reserve_cents',
            def: { type: Sequelize.INTEGER, allowNull: true },
        });

        // optional Buy Now (present in your ERD; keep nullable)
        await ensureColumn({
            camel: 'buyNowCents',
            snake: 'buy_now_cents',
            def: { type: Sequelize.INTEGER, allowNull: true },
        });

        // current high bid / leader
        await ensureColumn({
            camel: 'highBidCents',
            snake: 'high_bid_cents',
            def: { type: Sequelize.INTEGER, allowNull: true },
        });
        await ensureColumn({
            camel: 'highBidUserId',
            snake: 'high_bid_user_id',
            def: { type: Sequelize.BIGINT, allowNull: true },
        });

        // ladder
        await ensureColumn({
            camel: 'incrementLadderJson',
            snake: 'increment_ladder_json',
            def: { type: Sequelize.JSONB, allowNull: true },
        });

        // FKs
        if (!desc.vendorId && desc.vendor_id) {
            await q.renameColumn('auctions', 'vendor_id', 'vendorId');
        } else if (!desc.vendorId) {
            await q.addColumn('auctions', 'vendorId', { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 });
        }

        if (!desc.productId && desc.product_id) {
            await q.renameColumn('auctions', 'product_id', 'productId');
        } else if (!desc.productId) {
            await q.addColumn('auctions', 'productId', { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 });
        }

        // indexes (ignore if exist)
        await q.addIndex('auctions', ['status', 'endAt']).catch(() => {});
        await q
            .addIndex('auctions', ['vendorId', 'status', 'endAt'], { name: 'auctions_vendor_status_end_idx' })
            .catch(() => {});
        await q.addIndex('auctions', ['productId']).catch(() => {});
    },

    async down(q) {
        // Only drop columns we may have added/renamed; leave core FKs and enum in place.
        const desc = await q.describeTable('auctions').catch(() => null);
        if (!desc) return;

        async function dropIf(col) {
            if (desc[col]) {
                await q.removeColumn('auctions', col).catch(() => {});
            }
        }

        await dropIf('title');
        await dropIf('startAt');
        await dropIf('endAt');
        await dropIf('startingBidCents');
        await dropIf('reserveCents');
        await dropIf('buyNowCents');
        await dropIf('highBidCents');
        await dropIf('highBidUserId');
        await dropIf('incrementLadderJson');
        // Do not drop vendorId/productId or the status ENUM in down().
    },
};
