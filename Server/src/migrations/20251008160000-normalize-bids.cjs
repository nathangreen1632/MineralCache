'use strict';

module.exports = {
    async up(q, Sequelize) {
        const desc = await q.describeTable('bids').catch(() => null);
        if (!desc) return;

        // Column name keys may be lowercase depending on the dialect adapter
        const hasBidder = !!(desc.bidderUserId || desc.bidderuserid);
        const hasEffective = !!(desc.effectiveBidCents || desc.effectivebidcents);

        // 1) Rename bidderUserId -> userId (if present)
        if (hasBidder) {
            // Try exact-cased first, then lowercase fallback
            await q.renameColumn('bids', 'bidderUserId', 'userId').catch(async () => {
                await q.renameColumn('bids', 'bidderuserid', 'userId');
            });

            // Helpful index for lookups by user/auction
            try {
                const indexes = await q.showIndex('bids').catch(() => []);
                const haveIdx = indexes?.some(i => i?.name === 'bids_user_auction_idx');
                if (!haveIdx) {
                    await q.addIndex('bids', ['userId', 'auctionId'], { name: 'bids_user_auction_idx' });
                }
            } catch {}
        }

        // 2) Drop effectiveBidCents (older design) or at least make it nullable
        if (hasEffective) {
            try {
                await q.removeColumn('bids', 'effectiveBidCents');
            } catch {
                await q.changeColumn('bids', 'effectiveBidCents', {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                });
            }
        }
    },

    async down(q, Sequelize) {
        const desc = await q.describeTable('bids').catch(() => null);
        if (!desc) return;

        const hasUserId = !!(desc.userId || desc.userid);

        // Recreate legacy column if you really need to roll back
        if (hasUserId && !(desc.bidderUserId || desc.bidderuserid)) {
            await q.renameColumn('bids', 'userId', 'bidderUserId').catch(async () => {
                await q.renameColumn('bids', 'userid', 'bidderUserId');
            });
        }

        // Restore effectiveBidCents as nullable (we avoid forcing NOT NULL on rollback)
        if (!(desc.effectiveBidCents || desc.effectivebidcents)) {
            await q.addColumn('bids', 'effectiveBidCents', {
                type: Sequelize.INTEGER,
                allowNull: true,
            });
        }
    },
};
