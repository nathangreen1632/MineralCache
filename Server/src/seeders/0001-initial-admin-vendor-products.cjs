/* eslint-disable @typescript-eslint/no-var-requires */
const crypto = require('node:crypto');

function qid(name) { return `"${String(name).replace(/"/g, '""')}"`; }

async function resolveTable(qi, candidates) {
    for (const name of candidates) {
        try { await qi.describeTable(name); return name; } catch {}
    }
    return null;
}

async function getColumns(qi, table) {
    const d = await qi.describeTable(table);
    return new Set(Object.keys(d));
}

async function getTableMeta(qi, table) {
    return qi.describeTable(table);
}

function pickEnumValue(meta, column, preferred) {
    const col = meta?.[column];
    const labels = Array.isArray(col?.special) ? col.special : null;
    if (!labels || labels.length === 0) return undefined;
    for (const want of (preferred || [])) if (labels.includes(want)) return want;
    return labels[0];
}

function narrowToColumns(obj, colSet) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined && colSet.has(k)) out[k] = v;
    }
    return out;
}

async function insertAndFetchId(qi, table, whereObj, row) {
    await qi.bulkInsert(table, [row], {});
    const keys = Object.keys(whereObj);
    if (!keys.length) return null;
    const where = keys.map((k, i) => `${qid(k)} = :w${i}`).join(' AND ');
    const repl = {};
    keys.forEach((k, i) => { repl[`w${i}`] = whereObj[k]; });
    const [rows] = await qi.sequelize.query(
        `SELECT ${qid('id')} FROM ${qid(table)} WHERE ${where} LIMIT 1`,
        { replacements: repl }
    );
    return Array.isArray(rows) && rows[0] && Object.prototype.hasOwnProperty.call(rows[0], 'id')
        ? rows[0].id
        : null;
}

/** password: Admin123! */
function staticBcryptHash() {
    return '$2b$10$K/VXqpA3mYQF2rK5N3D9euq8yFSAkWcO2d2Yj6hH6lYx2rN6GmB1S';
}

module.exports = {
    /** @param {import('sequelize').QueryInterface} queryInterface */
    async up(queryInterface) {
        const usersTable    = await resolveTable(queryInterface, ['users', 'Users', 'app_users']);
        const vendorsTable  = await resolveTable(queryInterface, ['vendors', 'Vendors']);
        const productsTable = await resolveTable(queryInterface, ['products', 'Products']);
        if (!usersTable || !vendorsTable || !productsTable) {
            console.warn('[seed:init] Required tables missing'); return;
        }

        const userCols    = await getColumns(queryInterface, usersTable);
        const vendorCols  = await getColumns(queryInterface, vendorsTable);
        const productCols = await getColumns(queryInterface, productsTable);

        const vendorMeta  = await getTableMeta(queryInterface, vendorsTable);
        const productMeta = await getTableMeta(queryInterface, productsTable);

        const ts = new Date();

        // 1) Admin user (admin@mineralcache.local / Admin123!)
        const adminEmail = 'admin@mineralcache.local';
        const adminRow = narrowToColumns({
            email: adminEmail,
            role: userCols.has('role') ? 'admin' : undefined,          // enum_users_role
            dobVerified18: userCols.has('dobVerified18') ? true : undefined,
            name: userCols.has('name') ? 'Mineral Cache Admin' : undefined,
            displayName: userCols.has('displayName') ? 'Mineral Cache Admin' : undefined,
            passwordHash: userCols.has('passwordHash') ? staticBcryptHash() : undefined,
            status: userCols.has('status') ? 'active' : undefined,
            isActive: userCols.has('isActive') ? true : undefined,
            createdAt: userCols.has('createdAt') ? ts : undefined,
            updatedAt: userCols.has('updatedAt') ? ts : undefined,
        }, userCols);
        const adminId = (await insertAndFetchId(queryInterface, usersTable, { email: adminEmail }, adminRow)) || 1;

        // 2) Approved vendor owned by admin (columns optional, matched against ERD at runtime)
        const vendorSlug  = 'cascade-minerals';
        const vendorName  = 'Cascade Minerals';
        const approvedVal = pickEnumValue(vendorMeta, 'approvalStatus', ['approved', 'active', 'enabled']);

        const vendorRow = narrowToColumns({
            slug: vendorSlug,
            displayName: vendorName,
            name: vendorCols.has('name') ? vendorName : undefined,
            // either (or neither) may exist depending on your exact migration history
            ownerUserId: vendorCols.has('ownerUserId') ? adminId : undefined,
            userId:      vendorCols.has('userId')      ? adminId : undefined,

            approvalStatus: vendorCols.has('approvalStatus') ? approvedVal : undefined,
            approvedAt:     vendorCols.has('approvedAt')     ? ts : undefined,
            approvedBy:     vendorCols.has('approvedBy')     ? adminId : undefined,

            country: vendorCols.has('country') ? 'US' : undefined,

            createdAt: vendorCols.has('createdAt') ? ts : undefined,
            updatedAt: vendorCols.has('updatedAt') ? ts : undefined,
        }, vendorCols);

        const vendorId = (await insertAndFetchId(queryInterface, vendorsTable, { slug: vendorSlug }, vendorRow)) || 1;

        // 3) Exactly three products — no product_images seeded
        const conditionVal = pickEnumValue(productMeta, 'condition',
            ['pristine', 'excellent', 'very_good', 'good', 'fine', 'mint']
        );

        const samples = [
            {
                title: 'Rhodochrosite with Quartz',
                species: 'Rhodochrosite',
                locality: 'Sweet Home Mine, Park County, Colorado, USA',
                dims: { L: 5, W: 4, H: 3 }, // cm
                weightG: 120,
                priceCents: 22000,
                salePriceCents: 19900, // on sale
            },
            {
                title: 'Fluorite Octahedron',
                species: 'Fluorite',
                locality: 'Elmwood Mine, Tennessee, USA',
                dims: { L: 6, W: 5, H: 4 },
                weightG: 150,
                priceCents: 18000,
                salePriceCents: null,
            },
            {
                title: 'Quartz Cluster',
                species: 'Quartz',
                locality: 'Herkimer County, New York, USA',
                dims: { L: 7, W: 5, H: 4 },
                weightG: 210,
                priceCents: 9500,
                salePriceCents: 8900, // on sale
            },
        ];

        async function seedProduct(p) {
            const slugBase = String(p.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            const slug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`;

            const row = narrowToColumns({
                vendorId: vendorId,

                title: p.title,
                name: productCols.has('name') ? p.title : undefined, // if legacy "name" exists
                slug: productCols.has('slug') ? slug : undefined,

                species: p.species,
                locality: p.locality,
                synthetic: productCols.has('synthetic') ? false : undefined,
                condition: conditionVal,

                // Structured size/weight (match numeric(6,2) columns)
                lengthCm: productCols.has('lengthCm') ? p.dims?.L : undefined,
                widthCm:  productCols.has('widthCm')  ? p.dims?.W : undefined,
                heightCm: productCols.has('heightCm') ? p.dims?.H : undefined,
                weightG:  productCols.has('weightG')  ? p.weightG : undefined,

                // Pricing aligned to ERD
                priceCents: p.priceCents,
                salePriceCents: p.salePriceCents,
                saleStartAt: productCols.has('saleStartAt') ? null : undefined,
                saleEndAt: productCols.has('saleEndAt') ? null : undefined,

                // Timestamps
                createdAt: ts,
                updatedAt: ts,
            }, productCols);

            return insertAndFetchId(queryInterface, productsTable, { title: p.title }, row);
        }

        for (const s of samples) await seedProduct(s);

        // NOTE: Intentionally **no** inserts into product_images.
    },

    async down(queryInterface) {
        const usersTable    = await resolveTable(queryInterface, ['users', 'Users', 'app_users']);
        const vendorsTable  = await resolveTable(queryInterface, ['vendors', 'Vendors']);
        const productsTable = await resolveTable(queryInterface, ['products', 'Products']);
        const prodImagesTbl = await resolveTable(queryInterface, ['product_images', 'ProductImages', 'images']);
        if (!usersTable || !vendorsTable || !productsTable) return;

        const titles = ['Rhodochrosite with Quartz', 'Fluorite Octahedron', 'Quartz Cluster'];

        try {
            // If any images were added later by hand, remove them first to avoid FK errors
            if (prodImagesTbl) {
                const [rows] = await queryInterface.sequelize.query(
                    `SELECT ${qid('id')} FROM ${qid(productsTable)} WHERE ${qid('title')} IN (${titles.map((_, i) => `:t${i}`).join(', ')})`,
                    { replacements: Object.fromEntries(titles.map((t, i) => [`t${i}`, t])) }
                );
                const ids = Array.isArray(rows) ? rows.map(r => r.id).filter(v => Number.isFinite(Number(v))) : [];
                if (ids.length) {
                    await queryInterface.sequelize.query(
                        `DELETE FROM ${qid(prodImagesTbl)} WHERE ${qid('productId')} IN (${ids.map((_, i) => `:p${i}`).join(', ')})`,
                        { replacements: Object.fromEntries(ids.map((v, i) => [`p${i}`, v])) }
                    );
                }
            }

            await queryInterface.sequelize.query(
                `DELETE FROM ${qid(productsTable)} WHERE ${qid('title')} IN (${titles.map((_, i) => `:t${i}`).join(', ')})`,
                { replacements: Object.fromEntries(titles.map((t, i) => [`t${i}`, t])) }
            );
        } catch {}

        try {
            await queryInterface.sequelize.query(
                `DELETE FROM ${qid(vendorsTable)} WHERE ${qid('slug')} = :slug OR ${qid('displayName')} = :name`,
                { replacements: { slug: 'cascade-minerals', name: 'Cascade Minerals' } }
            );
        } catch {}

        try {
            await queryInterface.sequelize.query(
                `DELETE FROM ${qid(usersTable)} WHERE ${qid('email')} = :email`,
                { replacements: { email: 'admin@mineralcache.local' } }
            );
        } catch {}
    },
};
