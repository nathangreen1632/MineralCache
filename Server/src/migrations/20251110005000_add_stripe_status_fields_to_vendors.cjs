// Server/src/migrations/20251110005000_add_stripe_status_fields_to_vendors.cjs
'use strict';

module.exports = {
    async up(q, S) {
        // Use raw SQL with IF NOT EXISTS so a partially-applied migration can be re-run.
        await q.sequelize.query(`
      ALTER TABLE "public"."vendors"
        ADD COLUMN IF NOT EXISTS "stripe_charges_enabled" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "stripe_payouts_enabled"  BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "stripe_details_submitted" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "stripe_requirements_due" INTEGER,
        ADD COLUMN IF NOT EXISTS "stripe_last_sync_at" TIMESTAMP WITH TIME ZONE
    `);

        // Index the existing camelCase column name
        await q.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "vendors_stripe_account_id_idx"
      ON "public"."vendors" ("stripeAccountId")
    `);
    },

    async down(q, S) {
        await q.sequelize.query(`
      DROP INDEX IF EXISTS "vendors_stripe_account_id_idx"
    `);
        await q.sequelize.query(`
      ALTER TABLE "public"."vendors"
        DROP COLUMN IF EXISTS "stripe_last_sync_at",
        DROP COLUMN IF EXISTS "stripe_requirements_due",
        DROP COLUMN IF EXISTS "stripe_details_submitted",
        DROP COLUMN IF EXISTS "stripe_payouts_enabled",
        DROP COLUMN IF EXISTS "stripe_charges_enabled"
    `);
    }
};
