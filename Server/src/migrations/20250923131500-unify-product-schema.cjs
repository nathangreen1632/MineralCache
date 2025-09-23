/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const t = await queryInterface.sequelize.transaction();
        try {
            const hasCol = async (table, col) => {
                const desc = await queryInterface.describeTable(table);
                return Object.hasOwn(desc, col);
            };

            // --- ENUM types (create if missing) ---
            // condition enum
            await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_products_condition') THEN
            CREATE TYPE "enum_products_condition" AS ENUM ('pristine','minor_damage','repaired','restored');
          END IF;
        END$$;
      `, { transaction: t });

            // fluorescence mode enum
            await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_products_fluorescencemode') THEN
            CREATE TYPE "enum_products_fluorescenceMode" AS ENUM ('none','SW','LW','both');
          END IF;
        END$$;
      `, { transaction: t });

            // --- Dimensions (full) ---
            if (!(await hasCol('products', 'lengthCm'))) {
                await queryInterface.addColumn('products', 'lengthCm', {
                    type: Sequelize.DECIMAL(6,2),
                    allowNull: true,
                }, { transaction: t });
            }
            if (!(await hasCol('products', 'widthCm'))) {
                await queryInterface.addColumn('products', 'widthCm', {
                    type: Sequelize.DECIMAL(6,2),
                    allowNull: true,
                }, { transaction: t });
            }
            if (!(await hasCol('products', 'heightCm'))) {
                await queryInterface.addColumn('products', 'heightCm', {
                    type: Sequelize.DECIMAL(6,2),
                    allowNull: true,
                }, { transaction: t });
            }
            if (!(await hasCol('products', 'sizeNote'))) {
                await queryInterface.addColumn('products', 'sizeNote', {
                    type: Sequelize.TEXT,
                    allowNull: true,
                }, { transaction: t });
            }

            // --- Weight (g + ct) ---
            if (!(await hasCol('products', 'weightG'))) {
                await queryInterface.addColumn('products', 'weightG', {
                    type: Sequelize.DECIMAL(8,2),
                    allowNull: true,
                }, { transaction: t });
            }
            if (!(await hasCol('products', 'weightCt'))) {
                await queryInterface.addColumn('products', 'weightCt', {
                    type: Sequelize.DECIMAL(8,2),
                    allowNull: true,
                }, { transaction: t });
            }

            // --- Fluorescence (structured: mode + note + wavelengths JSONB) ---
            if (!(await hasCol('products', 'fluorescenceMode'))) {
                await queryInterface.addColumn('products', 'fluorescenceMode', {
                    type: 'enum_products_fluorescenceMode',
                    allowNull: false,
                    defaultValue: 'none',
                }, { transaction: t });
            }
            if (!(await hasCol('products', 'fluorescenceColorNote'))) {
                await queryInterface.addColumn('products', 'fluorescenceColorNote', {
                    type: Sequelize.TEXT,
                    allowNull: true,
                }, { transaction: t });
            }
            if (!(await hasCol('products', 'fluorescenceWavelengthNm'))) {
                await queryInterface.addColumn('products', 'fluorescenceWavelengthNm', {
                    // store as JSONB array of integers (e.g., [254, 365])
                    type: Sequelize.JSONB,
                    allowNull: true,
                }, { transaction: t });
            }

            // --- Condition (enum + note) ---
            if (!(await hasCol('products', 'condition'))) {
                await queryInterface.addColumn('products', 'condition', {
                    type: 'enum_products_condition',
                    allowNull: true,
                }, { transaction: t });
            }
            if (!(await hasCol('products', 'conditionNote'))) {
                await queryInterface.addColumn('products', 'conditionNote', {
                    type: Sequelize.TEXT,
                    allowNull: true,
                }, { transaction: t });
            }

            // --- Provenance (free text now + JSON trail later) ---
            if (!(await hasCol('products', 'provenanceNote'))) {
                await queryInterface.addColumn('products', 'provenanceNote', {
                    type: Sequelize.TEXT,
                    allowNull: true,
                }, { transaction: t });
            }
            if (!(await hasCol('products', 'provenanceTrail'))) {
                await queryInterface.addColumn('products', 'provenanceTrail', {
                    type: Sequelize.JSONB, // [{ owner, yearStart, yearEnd, note }]
                    allowNull: true,
                }, { transaction: t });
            }

            // --- Pricing (scheduled sale model) ---
            if (!(await hasCol('products', 'salePriceCents'))) {
                await queryInterface.addColumn('products', 'salePriceCents', {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    validate: { min: 0 },
                }, { transaction: t });
            }
            if (!(await hasCol('products', 'saleStartAt'))) {
                await queryInterface.addColumn('products', 'saleStartAt', {
                    type: Sequelize.DATE,
                    allowNull: true,
                }, { transaction: t });
            }
            if (!(await hasCol('products', 'saleEndAt'))) {
                await queryInterface.addColumn('products', 'saleEndAt', {
                    type: Sequelize.DATE,
                    allowNull: true,
                }, { transaction: t });
            }

            // Remove legacy sale fields if present
            if (await hasCol('products', 'compareAtCents')) {
                await queryInterface.removeColumn('products', 'compareAtCents', { transaction: t });
            }
            if (await hasCol('products', 'onSale')) {
                await queryInterface.removeColumn('products', 'onSale', { transaction: t });
            }
            // Remove legacy free-text size/weight if you had them (safe if absent)
            if (await hasCol('products', 'size')) {
                await queryInterface.removeColumn('products', 'size', { transaction: t });
            }
            if (await hasCol('products', 'weight')) {
                await queryInterface.removeColumn('products', 'weight', { transaction: t });
            }
            // If you temporarily had boolean fluorescence:
            if (await hasCol('products', 'fluorescence')) {
                await queryInterface.removeColumn('products', 'fluorescence', { transaction: t });
            }

            // --- Indexes for filters/sort ---
            // vendor / species / synthetic
            await queryInterface.addIndex('products', ['vendorId'], {
                name: 'products_vendorId_idx',
                transaction: t,
            });
            await queryInterface.addIndex('products', ['species'], {
                name: 'products_species_idx',
                transaction: t,
            });
            await queryInterface.addIndex('products', ['synthetic'], {
                name: 'products_synthetic_idx',
                transaction: t,
            });
            // condition / fluorescence
            await queryInterface.addIndex('products', ['condition'], {
                name: 'products_condition_idx',
                transaction: t,
            });
            await queryInterface.addIndex('products', ['fluorescenceMode'], {
                name: 'products_fluorescenceMode_idx',
                transaction: t,
            });
            // price & sale price
            await queryInterface.addIndex('products', ['priceCents'], {
                name: 'products_priceCents_idx',
                transaction: t,
            });
            await queryInterface.addIndex('products', ['salePriceCents'], {
                name: 'products_salePriceCents_idx',
                transaction: t,
            });
            // dimensions
            await queryInterface.addIndex('products', ['lengthCm'], {
                name: 'products_lengthCm_idx',
                transaction: t,
            });
            await queryInterface.addIndex('products', ['widthCm'], {
                name: 'products_widthCm_idx',
                transaction: t,
            });
            await queryInterface.addIndex('products', ['heightCm'], {
                name: 'products_heightCm_idx',
                transaction: t,
            });
            // recency sort
            await queryInterface.addIndex('products', ['createdAt'], {
                name: 'products_createdAt_idx',
                transaction: t,
            });

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    },

    async down(queryInterface) {
        // Keep it simple: we won't drop columns or types in down() to avoid data loss.
        // If you absolutely need to rollback, write a targeted down() for your environment.
    },
};
