'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const table = 'order_vendor';
        const qi = queryInterface;
        const cols = await qi.describeTable(table).catch(() => ({}));

        await qi.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_order_vendor_payoutStatus') THEN
          CREATE TYPE "enum_order_vendor_payoutStatus" AS ENUM ('pending','holding','transferred','reversed');
        END IF;
      END$$;
      ALTER TYPE "enum_order_vendor_payoutStatus" ADD VALUE IF NOT EXISTS 'pending';
      ALTER TYPE "enum_order_vendor_payoutStatus" ADD VALUE IF NOT EXISTS 'holding';
      ALTER TYPE "enum_order_vendor_payoutStatus" ADD VALUE IF NOT EXISTS 'transferred';
      ALTER TYPE "enum_order_vendor_payoutStatus" ADD VALUE IF NOT EXISTS 'reversed';
    `);

        if (!cols.payoutStatus) {
            await qi.addColumn(table, 'payoutStatus', {
                type: Sequelize.ENUM('pending', 'holding', 'transferred', 'reversed'),
                allowNull: false,
                defaultValue: 'pending',
            });
            await qi.sequelize.query(`
        ALTER TABLE "order_vendor" ALTER COLUMN "payoutStatus" SET DEFAULT 'pending';
        UPDATE "order_vendor" SET "payoutStatus" = 'pending' WHERE "payoutStatus" IS NULL;
        ALTER TABLE "order_vendor" ALTER COLUMN "payoutStatus" SET NOT NULL;
      `);
        }

        if (!cols.holdUntil) {
            await qi.addColumn(table, 'holdUntil', { type: Sequelize.DATE, allowNull: true });
        }

        if (!cols.transferId) {
            await qi.addColumn(table, 'transferId', { type: Sequelize.STRING(120), allowNull: true });
        }

        const indexes = await qi.showIndex(table).catch(() => []);
        const hasIdx = Array.isArray(indexes) && indexes.some(i => i.name === 'order_vendor_payoutStatus_holdUntil_idx');
        if (!hasIdx) {
            await qi.addIndex(table, ['payoutStatus', 'holdUntil'], { name: 'order_vendor_payoutStatus_holdUntil_idx' });
        }
    },

    async down(queryInterface) {
        const table = 'order_vendor';
        const qi = queryInterface;

        const indexes = await qi.showIndex(table).catch(() => []);
        const hasIdx = Array.isArray(indexes) && indexes.some(i => i.name === 'order_vendor_payoutStatus_holdUntil_idx');
        if (hasIdx) {
            await qi.removeIndex(table, 'order_vendor_payoutStatus_holdUntil_idx').catch(() => {});
        }

        const cols = await qi.describeTable(table).catch(() => ({}));
        if (cols.transferId) {
            await qi.removeColumn(table, 'transferId').catch(() => {});
        }
        if (cols.holdUntil) {
            await qi.removeColumn(table, 'holdUntil').catch(() => {});
        }
        if (cols.payoutStatus) {
            await qi.removeColumn(table, 'payoutStatus').catch(() => {});
        }

        await qi.sequelize.query(`DROP TYPE IF EXISTS "enum_order_vendor_payoutStatus";`);
    },
};
