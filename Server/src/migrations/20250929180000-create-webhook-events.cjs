'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Create the webhook_events table for idempotency (source + event_id unique)
        await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "webhook_events" (
        "id"            BIGSERIAL PRIMARY KEY,
        "source"        VARCHAR(32) NOT NULL DEFAULT 'stripe',
        "event_id"      VARCHAR(120) NOT NULL,
        "type"          VARCHAR(180) NOT NULL,
        "status"        VARCHAR(32)  NOT NULL DEFAULT 'received',
        "first_seen_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "processed_at"  TIMESTAMPTZ  NULL,
        "payload"       JSONB        NULL
      );
    `);

        // Idempotency guard: the same event (by provider + id) is unique
        await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'webhook_events_source_event_id_key'
        ) THEN
          ALTER TABLE "public"."webhook_events"
          ADD CONSTRAINT "webhook_events_source_event_id_key"
          UNIQUE ("source","event_id");
        END IF;
      END $$;
    `);

        // Helpful extra index
        await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "webhook_events_type_idx"
      ON "public"."webhook_events" ("type");
    `);
    },

    async down(queryInterface /*, Sequelize */) {
        await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "webhook_events_type_idx";
    `);
        await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS "public"."webhook_events"
      DROP CONSTRAINT IF EXISTS "webhook_events_source_event_id_key";
    `);
        await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS "public"."webhook_events";
    `);
    },
};
