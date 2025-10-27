'use strict';

/** @type {import('sequelize').QueryInterface} */
module.exports = {
    async up(q, Sequelize) {
        const t = await q.sequelize.transaction();
        try {
            const tablesRaw = await q.showAllTables({ transaction: t });
            const tables = (Array.isArray(tablesRaw) ? tablesRaw : []).map((v) =>
                typeof v === 'string' ? v.replace(/^public\./i, '').toLowerCase() : String(v)
            );

            if (!tables.includes('shipping_rule_tiers')) {
                await q.createTable(
                    'shipping_rule_tiers',
                    {
                        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
                        shipping_rule_id: {
                            type: Sequelize.BIGINT,
                            allowNull: false,
                            references: { model: 'shipping_rules', key: 'id' },
                            onDelete: 'CASCADE',
                            onUpdate: 'CASCADE',
                        },
                        kind: { type: Sequelize.ENUM('price', 'weight'), allowNull: false },
                        min_value: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                        max_value: { type: Sequelize.INTEGER, allowNull: true },
                        amount_cents: { type: Sequelize.INTEGER, allowNull: false },
                        priority: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 100 },
                        active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
                        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
                        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
                    },
                    { transaction: t }
                );

                await q.addIndex('shipping_rule_tiers', ['shipping_rule_id', 'kind', 'priority'], {
                    name: 'idx_shipping_rule_tiers_rule_kind_priority',
                    transaction: t,
                });
                await q.addIndex('shipping_rule_tiers', ['shipping_rule_id', 'active'], {
                    name: 'idx_shipping_rule_tiers_rule_active',
                    transaction: t,
                });
            }

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },

    async down(q) {
        const t = await q.sequelize.transaction();
        try {
            await q.removeIndex('shipping_rule_tiers', 'idx_shipping_rule_tiers_rule_kind_priority', { transaction: t }).catch(() => {});
            await q.removeIndex('shipping_rule_tiers', 'idx_shipping_rule_tiers_rule_active', { transaction: t }).catch(() => {});
            await q.dropTable('shipping_rule_tiers', { transaction: t }).catch(() => {});
            try {
                await q.sequelize.query(`DROP TYPE IF EXISTS "enum_shipping_rule_tiers_kind";`, { transaction: t });
            } catch {}
            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },
};
