'use strict';

/**
 * Idempotent guardrails for the users table:
 * - Adds columns if missing:
 *   - passwordHash TEXT
 *   - role VARCHAR(10) NOT NULL DEFAULT 'buyer'
 *   - dobVerified18 BOOLEAN NOT NULL DEFAULT false
 *   - vendorId BIGINT NULL  (matches vendors.id)
 * - Adds a CHECK constraint for role if missing: ('buyer'|'vendor'|'admin')
 * - Adds an index on role if missing
 *
 * Notes:
 * - Forward-only for columns (we do not drop them in down()).
 * - Optional: when vendors is finalized, add a proper FK on vendorId separately.
 */
module.exports = {
    async up(queryInterface) {
        // 1) Columns (add only if not present)
        await queryInterface.sequelize.query(`
            ALTER TABLE "users"
                ADD COLUMN IF NOT EXISTS "passwordHash" TEXT,
                ADD COLUMN IF NOT EXISTS "role" VARCHAR(10) NOT NULL DEFAULT 'buyer',
                ADD COLUMN IF NOT EXISTS "dobVerified18" BOOLEAN NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS "vendorId" BIGINT NULL;
        `);

        // 2) CHECK constraint on role (add only if missing)
        await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'users_role_check_enum'
        ) THEN
          ALTER TABLE "users"
          ADD CONSTRAINT users_role_check_enum
          CHECK (role IN ('buyer','vendor','admin'));
        END IF;
      END $$;
    `);

        // 3) Helpful index on role (cheap) — create only if missing
        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS users_role_idx ON "users"(role);
        `);

        // TODO (optional later): add FK once vendors is finalized:
        // await queryInterface.sequelize.query(`
        //   ALTER TABLE "users"
        //   ADD CONSTRAINT users_vendor_fk
        //   FOREIGN KEY ("vendorId") REFERENCES "vendors"(id) ON DELETE SET NULL;
        // `);
    },

    async down(queryInterface) {
        // Be conservative: drop the index/constraint if present; keep columns (forward-only).
        await queryInterface.sequelize.query(`
            DROP INDEX IF EXISTS users_role_idx;
        `);

        await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'users_role_check_enum'
        ) THEN
          ALTER TABLE "users" DROP CONSTRAINT users_role_check_enum;
        END IF;
      END $$;
    `);
    },
};
