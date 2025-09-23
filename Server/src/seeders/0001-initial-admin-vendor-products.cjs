/* eslint-disable @typescript-eslint/no-var-requires */
const crypto = require('node:crypto');

function qid(name) { return `"${String(name).replace(/"/g, '""')}"`; }
async function resolveTable(qi, candidates) {
    for (const name of candidates) { try { await qi.describeTable(name); return name; } catch {} }
    return null;
}
async function getColumns(qi, table) { const d = await qi.describeTable(table); return new Set(Object.keys(d)); }
async function getTableMeta(qi, table) { return qi.describeTable(table); }
function pickEnumValue(meta, column, preferred) {
    const col = meta?.[column]; const labels = Array.isArray(col?.special) ? col.special : null;
    if (!labels || labels.length === 0) return undefined;
    for (const want of (preferred || [])) if (labels.includes(want)) return want;
    return labels[0];
}
function narrowToColumns(obj, colSet) {
    const out = {}; for (const [k, v] of Object.entries(obj)) if (v !== undefined && colSet.has(k)) out[k] = v; return out;
}
async function insertAndFetchId(qi, table, whereObj, row) {
    await qi.bulkInsert(table, [row], {});
    const keys = Object.keys(whereObj); if (!keys.length) return null;
    const where = keys.map((k, i) => `${qid(k)} = :w${i}`).join(' AND ');
    const repl = {}; keys.forEach((k, i) => { repl[`w${i}`] = whereObj[k]; });
    const [rows] = await qi.sequelize.query(`SELECT ${qid('id')} FROM ${qid(table)} WHERE ${where} LIMIT 1`, { replacements: repl });
    return Array.isArray(rows) && rows[0] && Object.prototype.hasOwnProperty.call(rows[0], 'id') ? rows[0].id : null;
}
function staticBcryptHash() { return '$2b$10$K/VXqpA3mYQF2rK5N3D9euq8yFSAkWcO2d2Yj6hH6lYx2rN6GmB1S'; } // "Admin123!"
function sha1Hex(s) { const h = crypto.createHash('sha1'); h.update(String(s)); return h.digest('hex'); }

module.exports = {
    /** @param {import('sequelize').QueryInterface} queryInterface */
    async up(queryInterface) {
        const usersTable = await resolveTable(queryInterface, ['users', 'Users', 'app_users']);
        const vendorsTable = await resolveTable(queryInterface, ['vendors', 'Vendors']);
        const productsTable = await resolveTable(queryInterface, ['products', 'Products']);
        const prodImagesTable = await resolveTable(queryInterface, ['product_images', 'ProductImages', 'images']);
        if (!usersTable || !vendorsTable || !productsTable) { console.warn('[seed:init] Required tables missing'); return; }

        const userCols = await getColumns(queryInterface, usersTable);
        const vendorCols = await getColumns(queryInterface, vendorsTable);
        const productCols = await getColumns(queryInterface, productsTable);
        const imageCols = prodImagesTable ? await getColumns(queryInterface, prodImagesTable) : new Set();
        const productMeta = await getTableMeta(queryInterface, productsTable);
        const vendorMeta = await getTableMeta(queryInterface, vendorsTable);

        const ts = new Date();

        // 1) Admin user
        const adminEmail = 'admin@mineralcache.local';
        const adminRow = narrowToColumns({
            email: adminEmail,
            role: userCols.has('role') ? 'admin' : undefined,
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

        // 2) Approved vendor
        const vendorSlug = 'cascade-minerals';
        const vendorName = 'Cascade Minerals';
        const vendorStatus = pickEnumValue(vendorMeta, 'status', ['approved', 'active', 'enabled']);
        const vendorRow = narrowToColumns({
            slug: vendorSlug,
            displayName: vendorName,
            name: vendorCols.has('name') ? vendorName : undefined,
            ownerUserId: vendorCols.has('ownerUserId') ? adminId : undefined,
            userId: vendorCols.has('userId') ? adminId : undefined,
            status: vendorCols.has('status') ? vendorStatus : undefined,
            approvedAt: vendorCols.has('approvedAt') ? ts : undefined,
            approvedBy: vendorCols.has('approvedBy') ? adminId : undefined,
            createdAt: vendorCols.has('createdAt') ? ts : undefined,
            updatedAt: vendorCols.has('updatedAt') ? ts : undefined,
        }, vendorCols);
        const vendorId = (await insertAndFetchId(queryInterface, vendorsTable, { slug: vendorSlug }, vendorRow)) || 1;

        // 3) Products
        const samples = [
            { title: 'Rhodochrosite with Quartz', species: 'Rhodochrosite', locality: 'Sweet Home Mine, Park County, Colorado, USA', size: '5 × 4 × 3 cm', weightGrams: 120, priceCents: 22000, compareAtCents: 26000, onSale: true },
            { title: 'Fluorite Octahedron', species: 'Fluorite', locality: 'Elmwood Mine, Tennessee, USA', size: '6 × 5 × 4 cm', weightGrams: 150, priceCents: 18000, compareAtCents: null, onSale: false },
            { title: 'Quartz Cluster', species: 'Quartz', locality: 'Herkimer County, New York, USA', size: '7 × 5 × 4 cm', weightGrams: 210, priceCents: 9500, compareAtCents: 12900, onSale: true },
            { title: 'Azurite on Malachite', species: 'Azurite', locality: 'Touissit, Oujda-Angad, Morocco', size: '6 × 4 × 3 cm', weightGrams: 160, priceCents: 24000, compareAtCents: null, onSale: false },
        ];
        const productCondition = pickEnumValue(productMeta, 'condition', ['pristine', 'excellent', 'very_good', 'good', 'fine', 'mint']);

        async function seedProduct(p) {
            const slugBase = String(p.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            const slug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`;
            const row = narrowToColumns({
                vendorId: productCols.has('vendorId') ? vendorId : undefined,
                title: productCols.has('title') ? p.title : undefined,
                name: productCols.has('name') ? p.title : undefined,
                slug: productCols.has('slug') ? slug : undefined,
                species: productCols.has('species') ? p.species : undefined,
                locality: productCols.has('locality') ? p.locality : undefined,
                size: productCols.has('size') ? p.size : undefined,
                weightGrams: productCols.has('weightGrams') ? p.weightGrams : undefined,
                weight: productCols.has('weight') ? p.weightGrams : undefined,
                condition: productCols.has('condition') ? productCondition : undefined,
                synthetic: productCols.has('synthetic') ? false : undefined,
                onSale: productCols.has('onSale') ? Boolean(p.onSale) : undefined,
                priceCents: productCols.has('priceCents') ? p.priceCents : undefined,
                compareAtCents: productCols.has('compareAtCents') ? p.compareAtCents : undefined,
                createdAt: productCols.has('createdAt') ? ts : undefined,
                updatedAt: productCols.has('updatedAt') ? ts : undefined,
            }, productCols);
            const id = await insertAndFetchId(queryInterface, productsTable, { title: p.title }, row);
            return { id, title: p.title, slug };
        }

        const seededProducts = [];
        for (const s of samples) seededProducts.push(await seedProduct(s));

        // 4) Product images (align to your ERD columns)
        if (prodImagesTable) {
            let idx = 0;
            for (const pr of seededProducts) {
                if (!pr?.id) continue;
                const n = idx++; // sort order
                const fileExt = 'jpg';
                const fileName = `${pr.slug}-original.${fileExt}`;
                const baseRel = `samples/${pr.slug}/`;
                const origRel = `${baseRel}${fileName}`;
                const v320Rel = `${baseRel}${pr.slug}-w320.${fileExt}`;
                const v800Rel = `${baseRel}${pr.slug}-w800.${fileExt}`;
                const v1600Rel = `${baseRel}${pr.slug}-w1600.${fileExt}`;

                const imgRow = narrowToColumns({
                    productId: pr.id,

                    // ERD: fileName, mimeType, origPath + dims/bytes (NOT NULLs on your DB)
                    fileName,
                    mimeType: 'image/jpeg',
                    origPath: origRel,
                    origBytes: 125000,
                    origWidth: 1600,
                    origHeight: 1200,

                    // Derivative paths + dims/bytes (match your column names exactly)
                    v320Path: v320Rel,
                    v320Bytes: 25000,
                    v320Width: 320,
                    v320Height: 240,

                    v800Path: v800Rel,
                    v800Bytes: 65000,
                    v800Width: 800,
                    v800Height: 600,

                    v1600Path: v1600Rel,
                    v1600Bytes: 125000,
                    v1600Width: 1600,
                    v1600Height: 1200,

                    sortOrder: n,

                    // Timestamps
                    createdAt: ts,
                    updatedAt: ts,
                }, imageCols);

                await queryInterface.bulkInsert(prodImagesTable, [imgRow], {});
            }
        }
    },

    async down(queryInterface) {
        const usersTable = await resolveTable(queryInterface, ['users', 'Users', 'app_users']);
        const vendorsTable = await resolveTable(queryInterface, ['vendors', 'Vendors']);
        const productsTable = await resolveTable(queryInterface, ['products', 'Products']);
        const prodImagesTable = await resolveTable(queryInterface, ['product_images', 'ProductImages', 'images']);
        if (!usersTable || !vendorsTable || !productsTable) return;

        const titles = ['Rhodochrosite with Quartz', 'Fluorite Octahedron', 'Quartz Cluster', 'Azurite on Malachite'];

        try {
            const inList = titles.map((_, i) => `:t${i}`).join(', ');
            const repl = {}; titles.forEach((t, i) => (repl[`t${i}`] = t));
            const [rows] = await queryInterface.sequelize.query(
                `SELECT ${qid('id')} FROM ${qid(productsTable)} WHERE ${qid('title')} IN (${inList})`,
                { replacements: repl }
            );
            const ids = Array.isArray(rows) ? rows.map(r => r.id).filter(v => Number.isFinite(Number(v))) : [];

            if (prodImagesTable && ids.length) {
                const idList = ids.map((_, i) => `:p${i}`).join(', ');
                const rep2 = {}; ids.forEach((v, i) => (rep2[`p${i}`] = v));
                await queryInterface.sequelize.query(
                    `DELETE FROM ${qid(prodImagesTable)} WHERE ${qid('productId')} IN (${idList})`,
                    { replacements: rep2 }
                );
            }

            await queryInterface.sequelize.query(
                `DELETE FROM ${qid(productsTable)} WHERE ${qid('title')} IN (${inList})`,
                { replacements: repl }
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
