'use strict';

/**
 * Creates a singleton admin_settings table to hold:
 * - commission (bps) + min fee (cents)
 * - stripeEnabled flag
 * - shipping defaults (flat/per-item/free-threshold/handling, cents) + currency
 *
 * Safe to run multiple times.
 */
module.exports = {
    async up(q) {
        const sql = (s) => q.sequelize.query(s);

        await sql(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'admin_settings'
        ) THEN
          CREATE TABLE public.admin_settings (
            id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            commission_bps INTEGER NOT NULL DEFAULT 800,   -- 8% = 800 bps
            min_fee_cents INTEGER NOT NULL DEFAULT 75,     -- $0.75
            stripe_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            currency VARCHAR(8) NOT NULL DEFAULT 'usd',
            ship_flat_cents INTEGER NOT NULL DEFAULT 0,
            ship_per_item_cents INTEGER NOT NULL DEFAULT 0,
            ship_free_threshold_cents INTEGER NULL,
            ship_handling_cents INTEGER NULL,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          INSERT INTO public.admin_settings (id) VALUES (1)
          ON CONFLICT (id) DO NOTHING;
        END IF;
      END$$;
    `);

        // Trigger to auto-update updatedAt (idempotent)
        await sql(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_proc WHERE proname = 'set_admin_settings_updated_at'
        ) THEN
          CREATE OR REPLACE FUNCTION set_admin_settings_updated_at()
          RETURNS TRIGGER AS $BODY$
          BEGIN
            NEW."updatedAt" = NOW();
            RETURN NEW;
          END;$BODY$ LANGUAGE plpgsql;
        END IF;
      END$$;
    `);

        await sql(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger
          WHERE tgname = 'trg_admin_settings_updated_at'
        ) THEN
          CREATE TRIGGER trg_admin_settings_updated_at
          BEFORE UPDATE ON public.admin_settings
          FOR EACH ROW EXECUTE FUNCTION set_admin_settings_updated_at();
        END IF;
      END$$;
    `);
    },

    async down(q) {
        const sql = (s) => q.sequelize.query(s);
        await sql(`DROP TRIGGER IF EXISTS trg_admin_settings_updated_at ON public.admin_settings;`);
        await sql(`DROP FUNCTION IF EXISTS set_admin_settings_updated_at();`);
        await sql(`DROP TABLE IF EXISTS public.admin_settings;`);
    },
};
