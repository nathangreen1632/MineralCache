'use strict';

/**
 * Adds Vendor audit fields (idempotent):
 * - approvedBy BIGINT NULL  (matches users.id)
 * - approvedAt TIMESTAMPTZ NULL
 * - rejectedReason TEXT NULL
 *
 * Notes:
 * - Forward-safe: only adds columns if missing.
 * - Down: drops the three columns if present.
 */
module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE "vendors"
                ADD COLUMN IF NOT EXISTS "approvedBy" BIGINT NULL,
                ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ NULL,
                ADD COLUMN IF NOT EXISTS "rejectedReason" TEXT NULL;
        `);

        // Optional helpful index on approvalStatus for admin list filtering
        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS vendors_approval_status_idx
                ON "vendors" ("approvalStatus");
        `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE "vendors"
                DROP COLUMN IF EXISTS "approvedBy",
                DROP COLUMN IF EXISTS "approvedAt",
                DROP COLUMN IF EXISTS "rejectedReason";
        `);

        await queryInterface.sequelize.query(`
            DROP INDEX IF EXISTS vendors_approval_status_idx;
        `);
    },
};
