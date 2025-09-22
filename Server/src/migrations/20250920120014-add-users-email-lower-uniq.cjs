'use strict';

/**
 * Adds a case-insensitive unique index on users.email:
 *   CREATE UNIQUE INDEX users_email_lower_uniq ON "users"(lower(email));
 *
 * Idempotent behavior:
 * - No-ops if the index already exists.
 * - Fails early with a clear message if case-insensitive duplicates exist.
 */
module.exports = {
    async up(queryInterface) {
        // 1) Skip if the index already exists
        const [existsRows] = await queryInterface.sequelize.query(`
      SELECT to_regclass('public.users_email_lower_uniq') AS regclass;
    `);
        const alreadyExists =
            Array.isArray(existsRows) &&
            existsRows.length > 0 &&
            existsRows[0].regclass !== null;
        if (alreadyExists) return;

        // 2) Guard: if duplicates exist (case-insensitive), creating a UNIQUE index will fail.
        const [dups] = await queryInterface.sequelize.query(`
            SELECT lower(email) AS email_l, COUNT(*) AS c
            FROM "users"
            WHERE email IS NOT NULL
            GROUP BY lower(email)
            HAVING COUNT(*) > 1
            LIMIT 1;
        `);
        const hasDup = Array.isArray(dups) && dups.length > 0;
        if (hasDup) {
            throw new Error(
                'Cannot create unique index users_email_lower_uniq: duplicate emails exist (case-insensitive). ' +
                'Please dedupe "users.email" (case-insensitive) and re-run this migration.'
            );
        }

        // 3) Create the unique index
        await queryInterface.sequelize.query(`
            CREATE UNIQUE INDEX users_email_lower_uniq
                ON "users"(lower(email));
        `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            DROP INDEX IF EXISTS users_email_lower_uniq;
        `);
    },
};
