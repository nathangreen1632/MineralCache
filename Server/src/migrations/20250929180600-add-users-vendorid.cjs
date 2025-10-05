'use strict';

/**
 * Adds users.vendorId (BIGINT NULL), indexes it, adds FK to vendors(id),
 * and backfills approved vendors -> users.vendorId (and role='vendor' where appropriate).
 *
 * Safe to re-run: checks/try-catches prevent failures if pieces already exist.
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        const t = await queryInterface.sequelize.transaction();
        try {
            // 1) Add column if missing
            const desc = await queryInterface.describeTable('users').catch(() => ({}));
            if (!desc.vendorId) {
                await queryInterface.addColumn(
                    'users',
                    'vendorId',
                    { type: Sequelize.BIGINT, allowNull: true },
                    { transaction: t }
                );
            }

            // 2) Add index (idempotent via raw SQL IF NOT EXISTS for Postgres)
            await queryInterface.sequelize.query(
                'CREATE INDEX IF NOT EXISTS "users_vendorid_idx" ON "users" ("vendorId")',
                { transaction: t }
            );

            // 3) Add FK constraint if missing (Postgres has no IF NOT EXISTS for constraints)
            const [fkRows] = await queryInterface.sequelize.query(
                `SELECT conname
           FROM pg_constraint
          WHERE conname = 'users_vendorid_fkey'`,
                { transaction: t }
            );
            if (!Array.isArray(fkRows) || fkRows.length === 0) {
                await queryInterface.addConstraint(
                    'users',
                    {
                        fields: ['vendorId'],
                        name: 'users_vendorid_fkey',
                        type: 'foreign key',
                        references: { table: 'vendors', field: 'id' },
                        onUpdate: 'CASCADE',
                        onDelete: 'SET NULL',
                        transaction: t,
                    }
                );
            }

            // 4) Backfill: attach approved vendors -> users.vendorId and promote to vendor role (keep admins intact)
            await queryInterface.sequelize.query(
                `
        UPDATE "users" u
           SET "vendorId" = v."id",
               "role" = CASE WHEN u."role" <> 'admin' THEN 'vendor' ELSE u."role" END
          FROM "vendors" v
         WHERE v."userId" = u."id"
           AND v."approvalStatus" = 'approved'
           AND (u."vendorId" IS NULL OR u."vendorId" <> v."id")
        `,
                { transaction: t }
            );

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },

    async down(queryInterface /*, Sequelize */) {
        const t = await queryInterface.sequelize.transaction();
        try {
            // Drop FK if present
            await queryInterface.removeConstraint('users', 'users_vendorid_fkey', { transaction: t }).catch(() => {});

            // Drop index if present
            await queryInterface.removeIndex('users', 'users_vendorid_idx', { transaction: t }).catch(() => {});

            // Drop column if present
            const desc = await queryInterface.describeTable('users').catch(() => ({}));
            if (desc.vendorId) {
                await queryInterface.removeColumn('users', 'vendorId', { transaction: t });
            }

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },
};
