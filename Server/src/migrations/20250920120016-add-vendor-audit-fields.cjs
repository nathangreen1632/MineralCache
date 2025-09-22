'use strict';

/**
 * Adds Vendor audit fields (idempotent):
 * - approvedBy INTEGER NULL
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
      ALTER TABLE "Vendors"
        ADD COLUMN IF NOT EXISTS "approvedBy" INTEGER NULL,
        ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS "rejectedReason" TEXT NULL
    `);

        // Optional helpful index on approvalStatus for admin list filtering
        await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS vendors_approval_status_idx
      ON "Vendors"("approvalStatus");
    `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
      ALTER TABLE "Vendors"
        DROP COLUMN IF EXISTS "approvedBy",
        DROP COLUMN IF EXISTS "approvedAt",
        DROP COLUMN IF EXISTS "rejectedReason"
    `);

        await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS vendors_approval_status_idx;
    `);
    },
};
