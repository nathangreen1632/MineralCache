// Server/src/migrations/20250923131500-unify-product-schema.cjs
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
                    { transaction: t, replacements: { table, col }, type: q.sequelize.QueryTypes.SELECT }
                );
                return !!row;
            };

            const createIndexIfNotExists = async (name, table, cols, using = 'BTREE') => {
                const colsSql = cols.map((c) => `"${c}"`).join(', ');
                await q.sequelize.query(
                    `CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" USING ${using} (${colsSql});`,
                    { transaction: t }
                );
            };

            // ---------- ENUM types (idempotent) ----------
            // condition (already lowercased; fine to keep)
            await q.sequelize.query(
                `DO $$
         BEGIN
           CREATE TYPE "enum_products_condition" AS ENUM ('pristine','minor_damage','repaired','restored');
         EXCEPTION WHEN duplicate_object THEN NULL;
         END$$;`,
                { transaction: t }
            );

            // fluorescenceMode — normalize any mixed-case type, then ensure lowercase type exists
            await q.sequelize.query(
                `DO $$
         BEGIN
           IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_products_fluorescenceMode') THEN
             EXECUTE 'ALTER TYPE "enum_products_fluorescenceMode" RENAME TO enum_products_fluorescencemode';
           END IF;
         END$$;`,
                { transaction: t }
            );
            await q.sequelize.query(
                `DO $$
         BEGIN
           CREATE TYPE enum_products_fluorescencemode AS ENUM ('none','SW','LW','both');
         EXCEPTION WHEN duplicate_object THEN NULL;
         END$$;`,
                { transaction: t }
            );

            // ---------- Dimensions ----------
            if (!(await hasCol('products', 'lengthCm'))) {
                await q.addColumn('products', 'lengthCm', { type: Sequelize.DECIMAL(6, 2), allowNull: true }, { transaction: t });
            }
            if (!(await hasCol('products', 'widthCm'))) {
                await q.addColumn('products', 'widthCm', { type: Sequelize.DECIMAL(6, 2), allowNull: true }, { transaction: t });
            }
            if (!(await hasCol('products', 'heightCm'))) {
                await q.addColumn('products', 'heightCm', { type: Sequelize.DECIMAL(6, 2), allowNull: true }, { transaction: t });
            }
            if (!(await hasCol('products', 'sizeNote'))) {
                await q.addColumn('products', 'sizeNote', { type: Sequelize.TEXT, allowNull: true }, { transaction: t });
            }
            if (await hasCol('products', 'sizeCm')) {
                await q.removeColumn('products', 'sizeCm', { transaction: t });
            }

            // ---------- Weight ----------
            if (!(await hasCol('products', 'weightG'))) {
                await q.addColumn('products', 'weightG', { type: Sequelize.DECIMAL(8, 2), allowNull: true }, { transaction: t });
            }
            if (!(await hasCol('products', 'weightCt'))) {
                await q.addColumn('products', 'weightCt', { type: Sequelize.DECIMAL(8, 2), allowNull: true }, { transaction: t });
            }

            // ---------- Fluorescence (structured) ----------
            if (!(await hasCol('products', 'fluorescenceMode'))) {
                // IMPORTANT: reference the lowercased, unquoted type name
                await q.addColumn(
                    'products',
                    'fluorescenceMode',
                    { type: 'enum_products_fluorescencemode', allowNull: false, defaultValue: 'none' },
                    { transaction: t }
                );
            }
            if (!(await hasCol('products', 'fluorescenceColorNote'))) {
                await q.addColumn('products', 'fluorescenceColorNote', { type: Sequelize.TEXT, allowNull: true }, { transaction: t });
            }
            if (!(await hasCol('products', 'fluorescenceWavelengthNm'))) {
                await q.addColumn('products', 'fluorescenceWavelengthNm', { type: Sequelize.JSONB, allowNull: true }, { transaction: t });
            }
            if (await hasCol('products', 'fluorescence')) {
                await q.removeColumn('products', 'fluorescence', { transaction: t });
            }

            // ---------- Condition ----------
            if (await hasCol('products', 'condition')) {
                await q.sequelize.query(
                    `ALTER TABLE "products"
             ALTER COLUMN "condition" TYPE "enum_products_condition"
             USING (CASE
                      WHEN "condition" IN ('pristine','minor_damage','repaired','restored')
                      THEN "condition"::"enum_products_condition"
                      ELSE NULL
                    END)`,
                    { transaction: t }
                );
            } else {
                await q.addColumn('products', 'condition', { type: 'enum_products_condition', allowNull: true }, { transaction: t });
            }
            if (!(await hasCol('products', 'conditionNote'))) {
                await q.addColumn('products', 'conditionNote', { type: Sequelize.TEXT, allowNull: true }, { transaction: t });
            }

            // ---------- Provenance ----------
            if (!(await hasCol('products', 'provenanceNote'))) {
                await q.addColumn('products', 'provenanceNote', { type: Sequelize.TEXT, allowNull: true }, { transaction: t });
            }
            if (!(await hasCol('products', 'provenanceTrail'))) {
                await q.addColumn('products', 'provenanceTrail', { type: Sequelize.JSONB, allowNull: true }, { transaction: t });
            }
            if (await hasCol('products', 'provenance')) {
                await q.removeColumn('products', 'provenance', { transaction: t });
            }

            // ---------- Pricing ----------
            if (!(await hasCol('products', 'salePriceCents'))) {
                await q.addColumn('products', 'salePriceCents', { type: Sequelize.INTEGER, allowNull: true }, { transaction: t });
            }
            if (!(await hasCol('products', 'saleStartAt'))) {
                await q.addColumn('products', 'saleStartAt', { type: Sequelize.DATE, allowNull: true }, { transaction: t });
            }
            if (!(await hasCol('products', 'saleEndAt'))) {
                await q.addColumn('products', 'saleEndAt', { type: Sequelize.DATE, allowNull: true }, { transaction: t });
            }
            if (await hasCol('products', 'compareAtCents')) {
                await q.removeColumn('products', 'compareAtCents', { transaction: t });
            }
            if (await hasCol('products', 'onSale')) {
                await q.removeColumn('products', 'onSale', { transaction: t });
            }

            // ---------- Archive ----------
            if (!(await hasCol('products', 'archivedAt'))) {
                await q.addColumn('products', 'archivedAt', { type: Sequelize.DATE, allowNull: true }, { transaction: t });
            }

            // ---------- Mirror model constraints ----------
            if (await hasCol('products', 'locality')) {
                await q.sequelize.query(`ALTER TABLE "products" ALTER COLUMN "locality" DROP NOT NULL`, { transaction: t });
            }
            if (await hasCol('products', 'title')) {
                await q.sequelize.query(
                    `ALTER TABLE "products"
             ALTER COLUMN "title" TYPE VARCHAR(140)
             USING LEFT("title", 140)`,
                    { transaction: t }
                );
            }
            if (await hasCol('products', 'species')) {
                await q.sequelize.query(
                    `ALTER TABLE "products"
             ALTER COLUMN "species" TYPE VARCHAR(140)
             USING LEFT("species", 140)`,
                    { transaction: t }
                );
            }

            // ---------- Indexes ----------
            await createIndexIfNotExists('products_vendorId_idx', 'products', ['vendorId']);
            await createIndexIfNotExists('products_species_idx', 'products', ['species']);
            await createIndexIfNotExists('products_synthetic_idx', 'products', ['synthetic']);
            await createIndexIfNotExists('products_condition_idx', 'products', ['condition']);
            await createIndexIfNotExists('products_fluorescenceMode_idx', 'products', ['fluorescenceMode']);
            await createIndexIfNotExists('products_priceCents_idx', 'products', ['priceCents']);
            await createIndexIfNotExists('products_salePriceCents_idx', 'products', ['salePriceCents']);
            await createIndexIfNotExists('products_lengthCm_idx', 'products', ['lengthCm']);
            await createIndexIfNotExists('products_widthCm_idx', 'products', ['widthCm']);
            await createIndexIfNotExists('products_heightCm_idx', 'products', ['heightCm']);
            await createIndexIfNotExists('products_createdAt_idx', 'products', ['createdAt']);

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },

    async down() {
        // non-destructive rollback
    },
};
