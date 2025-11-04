'use strict';

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'order_vendor'
            AND column_name  = 'commissionPct'
        ) THEN
          EXECUTE 'ALTER TABLE public."order_vendor"
                   ALTER COLUMN "commissionPct" SET DEFAULT 0';
        END IF;
      END
      $$;
    `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'order_vendor'
            AND column_name  = 'commissionPct'
        ) THEN
          EXECUTE 'ALTER TABLE public."order_vendor"
                   ALTER COLUMN "commissionPct" DROP DEFAULT';
        END IF;
      END
      $$;
    `);
    }
};
