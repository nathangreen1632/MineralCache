/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(q) {
        // discover the enum type name to avoid hard-coding it
        const [rows] = await q.sequelize.query(`
      SELECT udt_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='auctions' AND column_name='status'
      LIMIT 1
    `);
        const aucType = rows?.[0]?.udt_name || 'enum_auctions_status';

        await q.sequelize.query(`
      CREATE OR REPLACE FUNCTION trg_block_recent_end()
      RETURNS trigger AS $$
      DECLARE v_count int;
      BEGIN
        IF NEW."status" IN ('scheduled'::${aucType}, 'live'::${aucType}) THEN
          SELECT count(*) INTO v_count
          FROM auctions
          WHERE "productId" = NEW."productId"
            AND "status" = 'ended'::${aucType}
            AND "endAt" > now() - interval '5 days';
          IF v_count > 0 THEN
            RAISE EXCEPTION 'AUCTION_LOCK_ACTIVE'
              USING ERRCODE = '23514'; -- check_violation
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS block_recent_end ON auctions;

      CREATE CONSTRAINT TRIGGER block_recent_end
      AFTER INSERT OR UPDATE OF "status","productId"
      ON auctions
      DEFERRABLE INITIALLY IMMEDIATE
      FOR EACH ROW
      EXECUTE FUNCTION trg_block_recent_end();
    `);
    },

    async down(q) {
        await q.sequelize.query(`
      DROP TRIGGER IF EXISTS block_recent_end ON auctions;
      DROP FUNCTION IF EXISTS trg_block_recent_end();
    `);
    },
};
