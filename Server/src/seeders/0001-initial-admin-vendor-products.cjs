/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

/**
 * Seeder: create ONLY the admin user.
 * Email:    admin@mineralcache.local
 * Password: Admin123!   (bcrypt hash below)
 */

/* ───────── helpers ───────── */
function qid(name) { return `"${String(name).replace(/"/g, '""')}"`; }
async function resolveTable(qi, candidates) {
    for (const n of candidates) { try { await qi.describeTable(n); return n; } catch {} }
    return null;
}
async function getColumns(qi, table) {
    const d = await qi.describeTable(table);
    return new Set(Object.keys(d));
}
function narrowToColumns(obj, colSet) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) if (v !== undefined && colSet.has(k)) out[k] = v;
    return out;
}
async function selectId(qi, table, whereObj) {
    const keys = Object.keys(whereObj || {});
    if (!keys.length) return null;
    const where = keys.map((k, i) => `${qid(k)} = :w${i}`).join(' AND ');
    const repl = {}; keys.forEach((k, i) => { repl[`w${i}`] = whereObj[k]; });
    const [rows] = await qi.sequelize.query(
        `SELECT ${qid('id')} FROM ${qid(table)} WHERE ${where} LIMIT 1`,
        { replacements: repl }
    );
    return Array.isArray(rows) && rows[0] && Object.prototype.hasOwnProperty.call(rows[0], 'id')
        ? rows[0].id
        : null;
}
async function upsertAndGetId(qi, table, whereObj, row) {
    const existingId = await selectId(qi, table, whereObj);
    if (existingId) return existingId;
    try { await qi.bulkInsert(table, [row], { ignoreDuplicates: true }); } catch {}
    return selectId(qi, table, whereObj);
}
// bcrypt hash for "Admin123!"
function staticBcryptHash() { return '$2b$10$K/VXqpA3mYQF2rK5N3D9euq8yFSAkWcO2d2Yj6hH6lYx2rN6GmB1S'; }

/* ───────── seeder ───────── */
module.exports = {
    /** @param {import('sequelize').QueryInterface} queryInterface */
    async up(queryInterface) {
        const usersTable = await resolveTable(queryInterface, ['users', 'Users', 'app_users']);
        if (!usersTable) { console.warn('[seed] users table not found'); return; }

        const userCols = await getColumns(queryInterface, usersTable);
        const ts = new Date();

        const adminEmail = 'admin@mineralcache.local';
        const hash = staticBcryptHash();

        // Build the row only with columns that exist in your schema.
        const row = narrowToColumns({
            email: adminEmail,
            // names are optional — only set if columns exist
            name:        userCols.has('name') ? 'Mineral Cache Admin' : undefined,
            displayName: userCols.has('displayName') ? 'Mineral Cache Admin' : undefined,

            // role/flags if present
            role:          userCols.has('role') ? 'admin' : undefined,
            status:        userCols.has('status') ? 'active' : undefined,
            isActive:      userCols.has('isActive') ? true : undefined,
            dobVerified18: userCols.has('dobVerified18') ? true : undefined,

            // password column variants (support either)
            passwordHash:  userCols.has('passwordHash') ? hash : undefined,
            password:      userCols.has('password') ? hash : undefined, // in case your model uses `password`

            createdAt: userCols.has('createdAt') ? ts : undefined,
            updatedAt: userCols.has('updatedAt') ? ts : undefined,
        }, userCols);

        await upsertAndGetId(queryInterface, usersTable, { email: adminEmail }, row);
        console.log('[seed] ensured admin user:', adminEmail);
    },

    async down(queryInterface) {
        const usersTable = await resolveTable(queryInterface, ['users', 'Users', 'app_users']);
        if (!usersTable) return;
        try {
            await queryInterface.sequelize.query(
                `DELETE FROM ${qid(usersTable)} WHERE ${qid('email')} = :email`,
                { replacements: { email: 'admin@mineralcache.local' } }
            );
            console.log('[seed] removed admin user');
        } catch (e) {
            console.warn('[seed] failed to remove admin user:', e?.message || e);
        }
    },
};
