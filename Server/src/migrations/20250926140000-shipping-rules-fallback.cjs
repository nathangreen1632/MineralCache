'use strict';

/**
 * Idempotent: adds columns used by the new shipping fallback + admin UI,
 * and creates helpful indexes/constraints.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        const qi = queryInterface;
        const { sequelize } = qi;

        // Columns (IF NOT EXISTS)
        await sequelize.query(`
      ALTER TABLE IF EXISTS public.shipping_rules
        ADD COLUMN IF NOT EXISTS active boolean DEFAULT true NOT NULL,
        ADD COLUMN IF NOT EXISTS is_default_global boolean DEFAULT false NOT NULL,
        ADD COLUMN IF NOT EXISTS priority integer DEFAULT 100 NOT NULL
    `);

        // Unique constraint: only one global default rule (vendor_id IS NULL)
        await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'shipping_rules_one_global_default_unique'
        ) THEN
          ALTER TABLE public.shipping_rules
            ADD CONSTRAINT shipping_rules_one_global_default_unique
            UNIQUE NULLS NOT DISTINCT (is_default_global, vendor_id)
            DEFERRABLE INITIALLY DEFERRED;
        END IF;
      END
      $$;
    `);

        // Helpful indexes
        await sequelize.query(`
      CREATE INDEX IF NOT EXISTS shipping_rules_vendor_active_idx
        ON public.shipping_rules (vendor_id, active, priority, id);
    `);

        await sequelize.query(`
      CREATE INDEX IF NOT EXISTS shipping_rules_global_active_idx
        ON public.shipping_rules (active, is_default_global, priority, id)
        WHERE vendor_id IS NULL;
    `);
    },

    async down(queryInterface /* , Sequelize */) {
        // Keep columns and indexes; they are harmless and used going forward.
    }
};
