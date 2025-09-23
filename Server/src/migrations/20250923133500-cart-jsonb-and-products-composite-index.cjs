'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(q, Sequelize) {
        const t = await q.sequelize.transaction();
        try {
            await q.sequelize.query(
                `SET LOCAL lock_timeout TO '5s'; SET LOCAL statement_timeout TO '120s';`,
                { transaction: t }
            );

            const hasCol = async (table, col) => {
                const [row] = await q.sequelize.query(
                    `SELECT 1
             FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = :table
              AND column_name = :col
            LIMIT 1`,
                    {
                        transaction: t,
                        replacements: { table, col },
                        type: q.sequelize.QueryTypes.SELECT,
                    }
                );
                return !!row;
            };

            const regclassExists = async (name) => {
                const [row] = await q.sequelize.query(
                    `SELECT to_regclass(:n) IS NOT NULL AS ok`,
                    {
                        transaction: t,
                        replacements: { n: `public.${name}` },
                        type: q.sequelize.QueryTypes.SELECT,
                    }
                );
                return !!row.ok;
            };

            // ---------- carts.itemsJson ----------
            if (!(await hasCol('carts', 'itemsJson'))) {
                await q.addColumn(
                    'carts',
                    'itemsJson',
                    {
                        type: Sequelize.JSONB,
                        allowNull: false,
                        defaultValue: [],
                    },
                    { transaction: t }
                );
            }

            // Backfill from cart_items → carts.itemsJson (if the old table exists)
            if (await regclassExists('cart_items')) {
                await q.sequelize.query(
                    `
          UPDATE "carts" c
             SET "itemsJson" = s.items
          FROM (
            SELECT "cartId" AS id,
                   jsonb_agg(
                     jsonb_build_object(
                       'productId', "productId",
                       'auctionId', "auctionId",
                       'qty', COALESCE("qty", 1),
                       'unitPriceSnapshotCents', "unitPriceSnapshotCents"
                     )
                     ORDER BY "id"
                   ) AS items
            FROM "cart_items"
            GROUP BY "cartId"
          ) s
          WHERE c.id = s.id
            AND (c."itemsJson" IS NULL OR c."itemsJson" = '[]'::jsonb);
        `,
                    { transaction: t }
                );
            }

            // Enforce one cart per user (matches your model’s unique index)
            // Check for dupes first to avoid a hard error.
            const dup = await q.sequelize.query(
                `SELECT "userId", COUNT(*) AS c
           FROM "carts"
          GROUP BY "userId"
         HAVING COUNT(*) > 1
          LIMIT 1;`,
                { transaction: t, type: q.sequelize.QueryTypes.SELECT }
            );
            if (dup && dup.length) {
                throw new Error(
                    `Cannot add unique index on carts(userId): found duplicate rows for userId=${dup[0].userId}`
                );
            }

            await q.sequelize.query(
                `CREATE UNIQUE INDEX IF NOT EXISTS carts_userId_uniq ON "carts"("userId");`,
                { transaction: t }
            );

            // Drop the legacy child table if present
            if (await regclassExists('cart_items')) {
                await q.sequelize.query(`DROP TABLE IF EXISTS "cart_items";`, {
                    transaction: t,
                });
            }

            // ---------- products composite index (as in Product model) ----------
            await q.sequelize.query(
                `CREATE INDEX IF NOT EXISTS products_vendor_created_idx
           ON "products"("vendorId","createdAt");`,
                { transaction: t }
            );

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },

    async down(q, Sequelize) {
        const t = await q.sequelize.transaction();
        try {
            // Drop composite index
            await q.sequelize.query(
                `DROP INDEX IF EXISTS products_vendor_created_idx;`,
                { transaction: t }
            );

            // Recreate legacy cart_items table (structure from original migration)
            await q.sequelize.query(
                `
        CREATE TABLE IF NOT EXISTS "cart_items" (
          "id"  BIGSERIAL PRIMARY KEY,
          "cartId" BIGINT NOT NULL REFERENCES "carts" ("id") ON DELETE CASCADE,
          "productId" BIGINT,
          "auctionId" BIGINT,
          "qty" INTEGER NOT NULL DEFAULT 1,
          "unitPriceSnapshotCents" INTEGER NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
                { transaction: t }
            );

            // Expand carts.itemsJson back into cart_items
            await q.sequelize.query(
                `
        INSERT INTO "cart_items"
          ("cartId","productId","auctionId","qty","unitPriceSnapshotCents","createdAt","updatedAt")
        SELECT c.id,
               (e->>'productId')::BIGINT,
               (e->>'auctionId')::BIGINT,
               COALESCE((e->>'qty')::INT, 1),
               COALESCE((e->>'unitPriceSnapshotCents')::INT, 0),
               NOW(), NOW()
          FROM "carts" c,
               LATERAL jsonb_array_elements(c."itemsJson") AS e
         WHERE c."itemsJson" IS NOT NULL
           AND jsonb_typeof(c."itemsJson") = 'array';
      `,
                { transaction: t }
            );

            // Drop uniqueness and column to revert schema
            await q.sequelize.query(
                `DROP INDEX IF EXISTS carts_userId_uniq;`,
                { transaction: t }
            );

            await q.removeColumn('carts', 'itemsJson', { transaction: t });

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },
};
