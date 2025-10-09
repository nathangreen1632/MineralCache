/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

const { Sequelize } = require('sequelize');

/** @type {{ up: (q: import('sequelize').QueryInterface)=>Promise<void>, down: (q: import('sequelize').QueryInterface)=>Promise<void> }} */
module.exports = {
    async up(queryInterface) {
        const table = 'shipping_rules';

        async function has(col) {
            const [rows] = await queryInterface.sequelize.query(
                `SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c`,
                { replacements: { t: table, c: col } }
            );
            return rows.length > 0;
        }

        const hasCamel = await has('perWeightCents');
        const hasSnake = await has('per_weight_cents');

        if (!hasCamel && hasSnake) {
            // Rename snake_case → camelCase to match current model usage
            await queryInterface.renameColumn(table, 'per_weight_cents', 'perWeightCents');
            // Ensure constraints/defaults are what the model expects
            await queryInterface.changeColumn(table, 'perWeightCents', {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            });
        } else if (!hasCamel && !hasSnake) {
            // Add the column fresh
            await queryInterface.addColumn(table, 'perWeightCents', {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            });
        }
        // If camel already exists, nothing to do.
    },

    async down(queryInterface) {
        const table = 'shipping_rules';

        async function has(col) {
            const [rows] = await queryInterface.sequelize.query(
                `SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c`,
                { replacements: { t: table, c: col } }
            );
            return rows.length > 0;
        }

        const hasCamel = await has('perWeightCents');
        const hasSnake = await has('per_weight_cents');

        try {
            if (hasCamel && !hasSnake) {
                // Revert rename
                await queryInterface.renameColumn(table, 'perWeightCents', 'per_weight_cents');
            } else if (hasCamel && hasSnake) {
                // Both present (unlikely) → remove camel to avoid dup
                await queryInterface.removeColumn(table, 'perWeightCents');
            }
        } catch {
            // no-op; keep migration idempotent-ish on down
        }
    },
};
