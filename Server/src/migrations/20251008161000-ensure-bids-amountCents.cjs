'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(q, Sequelize) {
        const desc = await q.describeTable('bids').catch(() => null);
        if (!desc) return;

        const has = (name) => {
            if (!desc) return false;
            const keys = Object.keys(desc);
            const lo = name.toLowerCase();
            return keys.some((k) => k.toLowerCase() === lo);
        };

        const tryRename = async (from, to) => {
            try {
                await q.renameColumn('bids', from, to);
                return true;
            } catch {
                try {
                    await q.renameColumn('bids', from.toLowerCase(), to);
                    return true;
                } catch {
                    return false;
                }
            }
        };

        // If amountCents already exists, we're done.
        if (has('amountCents')) return;

        // Try to normalize any legacy variants.
        const renamed =
            (has('amount')         && (await tryRename('amount', 'amountCents'))) ||
            (has('amount_cents')   && (await tryRename('amount_cents', 'amountCents'))) ||
            (has('bidAmountCents') && (await tryRename('bidAmountCents', 'amountCents')));

        if (!renamed) {
            // No legacy column found — add it.
            await q.addColumn('bids', 'amountCents', {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            });
        }

        // (Re)create helpful index if missing
        try {
            const idx = await q.showIndex('bids').catch(() => []);
            const have = idx?.some((i) => i?.name === 'bids_auction_amount_idx');
            if (!have) {
                await q.addIndex('bids', ['auctionId', 'amountCents'], {
                    name: 'bids_auction_amount_idx',
                });
            }
        } catch {}
    },

    async down(q, Sequelize) {
        const desc = await q.describeTable('bids').catch(() => null);
        if (!desc) return;
        // Minimal rollback: drop the index if present; keep column (safe).
        try { await q.removeIndex('bids', 'bids_auction_amount_idx'); } catch {}
    },
};
