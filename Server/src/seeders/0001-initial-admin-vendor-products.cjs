/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

const crypto = require('node:crypto');

/* ───────── helpers ───────── */
function qid(name) { return `"${String(name).replace(/"/g, '""')}"`; }
async function resolveTable(qi, candidates) { for (const n of candidates) { try { await qi.describeTable(n); return n; } catch {} } return null; }
async function getColumns(qi, table) { const d = await qi.describeTable(table); return new Set(Object.keys(d)); }
async function getTableMeta(qi, table) { return qi.describeTable(table); }
function pickEnumValue(meta, column, preferred) {
    const labels = Array.isArray(meta?.[column]?.special) ? meta[column].special : null;
    if (!labels || labels.length === 0) return undefined;
    for (const want of (preferred || [])) if (labels.includes(want)) return want;
    return labels[0];
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
    const [rows] = await qi.sequelize.query(`SELECT ${qid('id')} FROM ${qid(table)} WHERE ${where} LIMIT 1`, { replacements: repl });
    return Array.isArray(rows) && rows[0] && Object.prototype.hasOwnProperty.call(rows[0], 'id') ? rows[0].id : null;
}
async function upsertAndGetId(qi, table, whereObj, row) {
    // Try to find first (idempotent)
    const existingId = await selectId(qi, table, whereObj);
    if (existingId) return existingId;
    // Insert with DO NOTHING (PG) safety
    try {
        await qi.bulkInsert(table, [row], { ignoreDuplicates: true });
    } catch { /* ignore (unique conflict, etc.) */ }
    return selectId(qi, table, whereObj);
}
function staticBcryptHash() { return '$2b$10$K/VXqpA3mYQF2rK5N3D9euq8yFSAkWcO2d2Yj6hH6lYx2rN6GmB1S'; } // Admin123!
function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function priceAtPurchaseCents(pRow) { const sale = Number(pRow?.salePriceCents ?? 0); const base = Number(pRow?.priceCents ?? 0); return sale > 0 ? sale : base; }

/* ───────── seeder ───────── */
module.exports = {
    /** @param {import('sequelize').QueryInterface} queryInterface */
    async up(queryInterface) {
        const usersTable        = await resolveTable(queryInterface, ['users','Users','app_users']);
        const vendorsTable      = await resolveTable(queryInterface, ['vendors','Vendors']);
        const productsTable     = await resolveTable(queryInterface, ['products','Products']);
        const ordersTable       = await resolveTable(queryInterface, ['orders','Orders']);
        const orderItemsTable   = await resolveTable(queryInterface, ['order_items','OrderItems','orderItems']);
        const orderVendorsTable = await resolveTable(queryInterface, ['order_vendors','OrderVendors','orderVendors']);
        const paymentsTable     = await resolveTable(queryInterface, ['payments','order_payments','Payments','OrderPayments']);
        const addressesTable    = await resolveTable(queryInterface, ['addresses','Addresses','order_addresses','OrderAddresses']);

        if (!usersTable || !vendorsTable || !productsTable) {
            console.warn('[seed] required tables missing (users/vendors/products)'); return;
        }

        const userCols        = await getColumns(queryInterface, usersTable);
        const vendorCols      = await getColumns(queryInterface, vendorsTable);
        const productCols     = await getColumns(queryInterface, productsTable);
        const orderCols       = ordersTable ? await getColumns(queryInterface, ordersTable) : new Set();
        const itemCols        = orderItemsTable ? await getColumns(queryInterface, orderItemsTable) : new Set();
        const orderVendorCols = orderVendorsTable ? await getColumns(queryInterface, orderVendorsTable) : new Set();
        const paymentCols     = paymentsTable ? await getColumns(queryInterface, paymentsTable) : new Set();
        const addressCols     = addressesTable ? await getColumns(queryInterface, addressesTable) : new Set();

        const vendorMeta  = await getTableMeta(queryInterface, vendorsTable);
        const productMeta = await getTableMeta(queryInterface, productsTable);
        const orderMeta   = ordersTable ? await getTableMeta(queryInterface, ordersTable) : null;
        const paymentMeta = paymentsTable ? await getTableMeta(queryInterface, paymentsTable) : null;

        const ts = new Date();

        /* users */
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
        const adminId = await upsertAndGetId(queryInterface, usersTable, { email: adminEmail }, adminRow);

        async function seedBuyer(email, name) {
            const row = narrowToColumns({
                email,
                role: userCols.has('role') ? 'buyer' : undefined,
                dobVerified18: userCols.has('dobVerified18') ? true : undefined,
                name: userCols.has('name') ? name : undefined,
                displayName: userCols.has('displayName') ? name : undefined,
                passwordHash: userCols.has('passwordHash') ? staticBcryptHash() : undefined,
                status: userCols.has('status') ? 'active' : undefined,
                isActive: userCols.has('isActive') ? true : undefined,
                createdAt: userCols.has('createdAt') ? ts : undefined,
                updatedAt: userCols.has('updatedAt') ? ts : undefined,
            }, userCols);
            return upsertAndGetId(queryInterface, usersTable, { email }, row);
        }
        const aliceId = await seedBuyer('alice@example.com', 'Alice Buyer');
        const bobId   = await seedBuyer('bob@example.com', 'Bob Buyer');

        /* vendor */
        const vendorSlug  = 'cascade-minerals';
        const vendorName  = 'Cascade Minerals';
        const approvedVal = pickEnumValue(vendorMeta, 'approvalStatus', ['approved','active','enabled']);
        const vendorRow = narrowToColumns({
            slug: vendorSlug,
            displayName: vendorName,
            name: vendorCols.has('name') ? vendorName : undefined,
            ownerUserId: vendorCols.has('ownerUserId') ? adminId : undefined,
            userId:      vendorCols.has('userId') ? adminId : undefined,
            approvalStatus: vendorCols.has('approvalStatus') ? approvedVal : undefined,
            approvedAt:     vendorCols.has('approvedAt') ? ts : undefined,
            approvedBy:     vendorCols.has('approvedBy') ? adminId : undefined,
            country: vendorCols.has('country') ? 'US' : undefined,
            createdAt: vendorCols.has('createdAt') ? ts : undefined,
            updatedAt: vendorCols.has('updatedAt') ? ts : undefined,
        }, vendorCols);
        const vendorId = await upsertAndGetId(queryInterface, vendorsTable, { slug: vendorSlug }, vendorRow);

        /* products */
        const conditionVal = pickEnumValue(productMeta, 'condition', ['pristine','excellent','very_good','good','fine','mint']);
        const products = [
            { title:'Rhodochrosite with Quartz', species:'Rhodochrosite', locality:'Sweet Home Mine, Park County, Colorado, USA', dims:{L:5,W:4,H:3}, weightG:120, priceCents:22000, salePriceCents:19900 },
            { title:'Fluorite Octahedron',       species:'Fluorite',      locality:'Elmwood Mine, Tennessee, USA',               dims:{L:6,W:5,H:4}, weightG:150, priceCents:18000, salePriceCents:null   },
            { title:'Quartz Cluster',             species:'Quartz',        locality:'Herkimer County, New York, USA',            dims:{L:7,W:5,H:4}, weightG:210, priceCents:9500,  salePriceCents:8900   },
            { title:'Barite on Galena',           species:'Barite',        locality:'Cave-in-Rock, Illinois, USA',               dims:{L:8,W:6,H:5}, weightG:320, priceCents:26000, salePriceCents:null   },
            { title:'Aquamarine Crystal',         species:'Beryl var. Aquamarine', locality:'Shigar Valley, Gilgit-Baltistan, Pakistan', dims:{L:5,W:2.5,H:2.5}, weightG:75, priceCents:28500, salePriceCents:25900 },
            { title:'Vanadinite on Matrix',       species:'Vanadinite',    locality:'Mibladen, Morocco',                          dims:{L:6,W:5,H:4}, weightG:190, priceCents:14000, salePriceCents:null   },
        ];

        const productIdByTitle = new Map();
        async function seedProduct(p) {
            const where = { title: p.title };
            const existingId = await selectId(queryInterface, productsTable, where);
            if (existingId) { productIdByTitle.set(p.title, existingId); return existingId; }

            const slug = `${slugify(p.title)}-${crypto.randomUUID().slice(0, 8)}`;
            const row = narrowToColumns({
                vendorId,
                title: p.title,
                name: productCols.has('name') ? p.title : undefined,
                slug: productCols.has('slug') ? slug : undefined,
                species: p.species,
                locality: p.locality,
                synthetic: productCols.has('synthetic') ? false : undefined,
                condition: conditionVal,
                lengthCm: productCols.has('lengthCm') ? p.dims?.L : undefined,
                widthCm:  productCols.has('widthCm')  ? p.dims?.W : undefined,
                heightCm: productCols.has('heightCm') ? p.dims?.H : undefined,
                weightG:  productCols.has('weightG')  ? p.weightG : undefined,
                priceCents: productCols.has('priceCents') ? p.priceCents : undefined,
                salePriceCents: productCols.has('salePriceCents') ? (p.salePriceCents ?? null) : undefined,
                saleStartAt: productCols.has('saleStartAt') ? null : undefined,
                saleEndAt:   productCols.has('saleEndAt')   ? null : undefined,
                createdAt: productCols.has('createdAt') ? ts : undefined,
                updatedAt: productCols.has('updatedAt') ? ts : undefined,
            }, productCols);

            const id = await upsertAndGetId(queryInterface, productsTable, where, row);
            productIdByTitle.set(p.title, id);
            return id;
        }
        for (const p of products) await seedProduct(p);

        /* addresses (optional) */
        async function seedAddress(userId, name, line1, city, region, postal, country) {
            if (!addressesTable) return null;
            const where = addressCols.has('userId') ? { userId } : {};
            const existing = await selectId(queryInterface, addressesTable, where);
            if (existing) return existing;
            const row = narrowToColumns({
                userId:     addressCols.has('userId') ? userId : undefined,
                name:       addressCols.has('name') ? name : undefined,
                fullName:   addressCols.has('fullName') ? name : undefined,
                line1:      addressCols.has('line1') ? line1 : undefined,
                address1:   addressCols.has('address1') ? line1 : undefined,
                city:       addressCols.has('city') ? city : undefined,
                region:     addressCols.has('region') ? region : undefined,
                state:      addressCols.has('state') ? region : undefined,
                postal:     addressCols.has('postal') ? postal : undefined,
                postalCode: addressCols.has('postalCode') ? postal : undefined,
                country:    addressCols.has('country') ? country : undefined,
                createdAt:  addressCols.has('createdAt') ? ts : undefined,
                updatedAt:  addressCols.has('updatedAt') ? ts : undefined,
            }, addressCols);
            return upsertAndGetId(queryInterface, addressesTable, where, row);
        }
        const aliceAddressId = await seedAddress(aliceId, 'Alice Buyer', '101 Main St', 'Bend', 'OR', '97701', 'US');
        const bobAddressId   = await seedAddress(bobId,   'Bob Buyer',   '77 Pine Ave', 'Boise', 'ID', '83702', 'US');

        /* cleanup old demo orders so seeds are repeatable */
        if (ordersTable && orderItemsTable) {
            try {
                const buyerIds = [aliceId, bobId].filter(Boolean);
                if (buyerIds.length) {
                    const [orderRows] = await queryInterface.sequelize.query(
                        `SELECT ${qid('id')} FROM ${qid(ordersTable)} WHERE `
                        + (orderCols.has('buyerUserId') && orderCols.has('userId')
                            ? `(${qid('buyerUserId')} IN (:a,:b) OR ${qid('userId')} IN (:a,:b))`
                            : orderCols.has('buyerUserId')
                                ? `${qid('buyerUserId')} IN (:a,:b)`
                                : orderCols.has('userId')
                                    ? `${qid('userId')} IN (:a,:b)` : '1=2'),
                        { replacements: { a: buyerIds[0] ?? -1, b: buyerIds[1] ?? -1 } }
                    );
                    const oids = (Array.isArray(orderRows) ? orderRows.map(r => r.id) : []).filter(Boolean);
                    if (oids.length) {
                        if (paymentsTable) {
                            await queryInterface.sequelize.query(
                                `DELETE FROM ${qid(paymentsTable)} WHERE ${qid('orderId')} IN (${oids.map((_,i)=>`:o${i}`).join(',')})`,
                                { replacements: Object.fromEntries(oids.map((id,i)=>[`o${i}`, id])) }
                            );
                        }
                        if (orderVendorsTable) {
                            await queryInterface.sequelize.query(
                                `DELETE FROM ${qid(orderVendorsTable)} WHERE ${qid('orderId')} IN (${oids.map((_,i)=>`:o${i}`).join(',')})`,
                                { replacements: Object.fromEntries(oids.map((id,i)=>[`o${i}`, id])) }
                            );
                        }
                        await queryInterface.sequelize.query(
                            `DELETE FROM ${qid(orderItemsTable)} WHERE ${qid('orderId')} IN (${oids.map((_,i)=>`:o${i}`).join(',')})`,
                            { replacements: Object.fromEntries(oids.map((id,i)=>[`o${i}`, id])) }
                        );
                        await queryInterface.sequelize.query(
                            `DELETE FROM ${qid(ordersTable)} WHERE ${qid('id')} IN (${oids.map((_,i)=>`:o${i}`).join(',')})`,
                            { replacements: Object.fromEntries(oids.map((id,i)=>[`o${i}`, id])) }
                        );
                    }
                }
            } catch (e) {
                console.warn('[seed] cleanup old orders skipped:', e?.message || e);
            }
        }

        /* orders (with item snapshots) */
        if (!ordersTable || !orderItemsTable) { console.warn('[seed] orders/order_items tables not found'); return; }

        const statusPaid = pickEnumValue(orderMeta, 'status', ['paid','succeeded','completed','processing']);
        const statusNew  = pickEnumValue(orderMeta, 'status', ['new','created','pending']);
        const payOk      = pickEnumValue(paymentMeta, 'status', ['succeeded','paid','completed']);

        const platformPct = 0.08;  // 8%
        const platformMin = 75;    // $0.75 in cents
        const feeFor = (subtotal) => Math.max(Math.round(subtotal * platformPct), platformMin);

        async function seedOrder({ buyerUserId, addressId, email, items, paid }) {
            // build items from products + compute totals
            const prepared = [];
            let subtotal = 0;
            for (const it of items) {
                const pid = productIdByTitle.get(it.title);
                if (!pid) continue;
                const [rows] = await queryInterface.sequelize.query(
                    `SELECT * FROM ${qid(productsTable)} WHERE ${qid('id')} = :id LIMIT 1`, { replacements: { id: pid } }
                );
                const p = Array.isArray(rows) ? rows[0] : null;
                if (!p) continue;
                const unit = priceAtPurchaseCents(p);
                subtotal += unit * it.qty;
                prepared.push({ productId: pid, qty: it.qty, unitCents: unit, p });
            }

            const shippingCents = 1200;
            const taxCents = 0;
            const totalCents = subtotal + shippingCents + taxCents;
            const platformFeeCents = feeFor(subtotal);

            const orderRow = narrowToColumns({
                // IMPORTANT: some codepaths expect both columns
                buyerUserId: orderCols.has('buyerUserId') ? buyerUserId : undefined,
                userId:      orderCols.has('userId')      ? buyerUserId : undefined,

                email: orderCols.has('email') ? email : undefined,

                shippingName:     orderCols.has('shippingName') ? (email?.split('@')[0] || 'Buyer') : undefined,
                shippingAddress1: orderCols.has('shippingAddress1') ? 'Demo Address 1' : undefined,
                shippingCity:     orderCols.has('shippingCity') ? 'Bend' : undefined,
                shippingRegion:   orderCols.has('shippingRegion') ? 'OR' : undefined,
                shippingPostal:   orderCols.has('shippingPostal') ? '97701' : undefined,
                shippingCountry:  orderCols.has('shippingCountry') ? 'US' : undefined,

                addressId: orderCols.has('addressId') ? addressId : undefined,

                subtotalCents:    orderCols.has('subtotalCents') ? subtotal : undefined,
                shippingCents:    orderCols.has('shippingCents') ? shippingCents : undefined,
                taxCents:         orderCols.has('taxCents') ? taxCents : undefined,
                totalCents:       orderCols.has('totalCents') ? totalCents : undefined,
                platformFeeCents: orderCols.has('platformFeeCents') ? platformFeeCents : undefined,
                platformFeePct:   orderCols.has('platformFeePct') ? platformPct : undefined,
                platformPct:      orderCols.has('platformPct') ? platformPct : undefined,

                status: orderCols.has('status') ? (paid ? statusPaid : statusNew) : undefined,

                createdAt: orderCols.has('createdAt') ? ts : undefined,
                updatedAt: orderCols.has('updatedAt') ? ts : undefined,
            }, orderCols);

            // deterministic uniqueness key for re-runs: buyer + subtotal + total
            const whereForId = (() => {
                const w = {};
                if (orderCols.has('buyerUserId')) w['buyerUserId'] = buyerUserId;
                else if (orderCols.has('userId')) w['userId'] = buyerUserId;
                if (orderCols.has('totalCents')) w['totalCents'] = totalCents;
                if (orderCols.has('subtotalCents')) w['subtotalCents'] = subtotal;
                return w;
            })();

            const orderId = await upsertAndGetId(queryInterface, ordersTable, whereForId, orderRow);

            // items with snapshots
            for (const it of prepared) {
                const p = it.p || {};
                const itemRow = narrowToColumns({
                    orderId,
                    productId: it.productId,
                    vendorId,

                    quantity: itemCols.has('quantity') ? it.qty : undefined,
                    qty:      itemCols.has('qty') ? it.qty : undefined,
                    unitPriceCents: itemCols.has('unitPriceCents') ? it.unitCents : undefined,
                    priceCents:     itemCols.has('priceCents') ? it.unitCents : undefined,
                    totalCents:     itemCols.has('totalCents') ? (it.unitCents * it.qty) : undefined,

                    // snapshots (guard every column)
                    titleSnapshot:             itemCols.has('titleSnapshot')             ? (p.title || null) : undefined,
                    nameSnapshot:              itemCols.has('nameSnapshot')              ? (p.title || null) : undefined,
                    productTitleSnapshot:      itemCols.has('productTitleSnapshot')      ? (p.title || null) : undefined,
                    speciesSnapshot:           itemCols.has('speciesSnapshot')           ? (p.species ?? null) : undefined,
                    localitySnapshot:          itemCols.has('localitySnapshot')          ? (p.locality ?? null) : undefined,
                    conditionSnapshot:         itemCols.has('conditionSnapshot')         ? (p.condition ?? null) : undefined,
                    lengthCmSnapshot:          itemCols.has('lengthCmSnapshot')          ? (p.lengthCm ?? null) : undefined,
                    widthCmSnapshot:           itemCols.has('widthCmSnapshot')           ? (p.widthCm ?? null) : undefined,
                    heightCmSnapshot:          itemCols.has('heightCmSnapshot')          ? (p.heightCm ?? null) : undefined,
                    weightGSnapshot:           itemCols.has('weightGSnapshot')           ? (p.weightG ?? null) : undefined,
                    priceSnapshotCents:        itemCols.has('priceSnapshotCents')        ? it.unitCents : undefined,
                    vendorDisplayNameSnapshot: itemCols.has('vendorDisplayNameSnapshot') ? 'Cascade Minerals' : undefined,
                    vendorNameSnapshot:        itemCols.has('vendorNameSnapshot')        ? 'Cascade Minerals' : undefined,
                    vendorSlugSnapshot:        itemCols.has('vendorSlugSnapshot')        ? 'cascade-minerals' : undefined,
                    productSlugSnapshot:       itemCols.has('productSlugSnapshot')       ? (p.slug ?? null) : undefined,

                    refundedQty:   itemCols.has('refundedQty')   ? 0 : undefined,
                    discountCents: itemCols.has('discountCents') ? 0 : undefined,
                    discountPct:   itemCols.has('discountPct')   ? 0 : undefined,
                    taxCents:      itemCols.has('taxCents')      ? 0 : undefined,
                    shippingCents: itemCols.has('shippingCents') ? 0 : undefined,
                    feeCents:      itemCols.has('feeCents')      ? 0 : undefined,
                    isRefunded:    itemCols.has('isRefunded')    ? false : undefined,
                    isCancelled:   itemCols.has('isCancelled')   ? false : undefined,

                    createdAt: itemCols.has('createdAt') ? ts : undefined,
                    updatedAt: itemCols.has('updatedAt') ? ts : undefined,
                }, itemCols);

                // idempotent insert: try unique-ish match on (orderId, productId) if columns exist
                const whereItem = {};
                if (itemCols.has('orderId')) whereItem.orderId = orderId;
                if (itemCols.has('productId')) whereItem.productId = it.productId;
                const exists = Object.keys(whereItem).length ? await selectId(queryInterface, orderItemsTable, whereItem) : null;
                if (!exists) {
                    try { await queryInterface.bulkInsert(orderItemsTable, [itemRow], { ignoreDuplicates: true }); } catch {}
                }
            }

            // vendor split
            if (orderVendorsTable) {
                const ovRow = narrowToColumns({
                    orderId, vendorId,
                    subtotalCents:    orderVendorCols.has('subtotalCents') ? subtotal : undefined,
                    shippingCents:    orderVendorCols.has('shippingCents') ? shippingCents : undefined,
                    taxCents:         orderVendorCols.has('taxCents') ? taxCents : undefined,
                    platformFeeCents: orderVendorCols.has('platformFeeCents') ? platformFeeCents : undefined,
                    totalCents:       orderVendorCols.has('totalCents') ? (subtotal + shippingCents + taxCents) : undefined,
                    createdAt: orderVendorCols.has('createdAt') ? ts : undefined,
                    updatedAt: orderVendorCols.has('updatedAt') ? ts : undefined,
                }, orderVendorCols);

                const whereOV = { orderId, ...(orderVendorCols.has('vendorId') ? { vendorId } : {}) };
                const ovExists = await selectId(queryInterface, orderVendorsTable, whereOV);
                if (!ovExists) { try { await queryInterface.bulkInsert(orderVendorsTable, [ovRow], { ignoreDuplicates: true }); } catch {} }
            }

            // payment
            if (paymentsTable && paid) {
                const payRow = narrowToColumns({
                    orderId,
                    amountCents: paymentCols.has('amountCents') ? totalCents : undefined,
                    processor:   paymentCols.has('processor') ? 'stripe' : undefined,
                    status:      paymentCols.has('status') ? payOk : undefined,
                    createdAt: paymentCols.has('createdAt') ? ts : undefined,
                    updatedAt: paymentCols.has('updatedAt') ? ts : undefined,
                }, paymentCols);
                const payExists = await selectId(queryInterface, paymentsTable, { orderId });
                if (!payExists) { try { await queryInterface.bulkInsert(paymentsTable, [payRow], { ignoreDuplicates: true }); } catch {} }
            }
        }

        // three showcase orders
        await seedOrder({
            buyerUserId: aliceId, addressId: aliceAddressId, email: 'alice@example.com',
            items: [{ title:'Rhodochrosite with Quartz', qty:1 }, { title:'Quartz Cluster', qty:2 }],
            paid: true,
        });
        await seedOrder({
            buyerUserId: bobId, addressId: bobAddressId, email: 'bob@example.com',
            items: [{ title:'Vanadinite on Matrix', qty:1 }],
            paid: true,
        });
        await seedOrder({
            buyerUserId: aliceId, addressId: aliceAddressId, email: 'alice@example.com',
            items: [{ title:'Fluorite Octahedron', qty:1 }, { title:'Barite on Galena', qty:1 }, { title:'Aquamarine Crystal', qty:1 }],
            paid: false,
        });
    },

    async down(queryInterface) {
        const usersTable        = await resolveTable(queryInterface, ['users','Users','app_users']);
        const vendorsTable      = await resolveTable(queryInterface, ['vendors','Vendors']);
        const productsTable     = await resolveTable(queryInterface, ['products','Products']);
        const ordersTable       = await resolveTable(queryInterface, ['orders','Orders']);
        const orderItemsTable   = await resolveTable(queryInterface, ['order_items','OrderItems','orderItems']);
        const orderVendorsTable = await resolveTable(queryInterface, ['order_vendors','OrderVendors','orderVendors']);
        const paymentsTable     = await resolveTable(queryInterface, ['payments','order_payments','Payments','OrderPayments']);

        const titles = [
            'Rhodochrosite with Quartz','Fluorite Octahedron','Quartz Cluster',
            'Barite on Galena','Aquamarine Crystal','Vanadinite on Matrix',
        ];

        try {
            if (ordersTable && orderItemsTable) {
                const [prodRows] = await queryInterface.sequelize.query(
                    `SELECT ${qid('id')} FROM ${qid(productsTable)} WHERE ${qid('title')} IN (${titles.map((_,i)=>`:t${i}`).join(',')})`,
                    { replacements: Object.fromEntries(titles.map((t,i)=>[`t${i}`, t])) }
                );
                const pids = Array.isArray(prodRows) ? prodRows.map(r => r.id) : [];
                if (pids.length) {
                    const [orderRows] = await queryInterface.sequelize.query(
                        `SELECT DISTINCT ${qid('orderId')} AS id FROM ${qid(orderItemsTable)} WHERE ${qid('productId')} IN (${pids.map((_,i)=>`:p${i}`).join(',')})`,
                        { replacements: Object.fromEntries(pids.map((id,i)=>[`p${i}`, id])) }
                    );
                    const oids = Array.isArray(orderRows) ? orderRows.map(r => r.id) : [];
                    if (paymentsTable && oids.length) {
                        await queryInterface.sequelize.query(
                            `DELETE FROM ${qid(paymentsTable)} WHERE ${qid('orderId')} IN (${oids.map((_,i)=>`:o${i}`).join(',')})`,
                            { replacements: Object.fromEntries(oids.map((id,i)=>[`o${i}`, id])) }
                        );
                    }
                    if (orderVendorsTable && oids.length) {
                        await queryInterface.sequelize.query(
                            `DELETE FROM ${qid(orderVendorsTable)} WHERE ${qid('orderId')} IN (${oids.map((_,i)=>`:o${i}`).join(',')})`,
                            { replacements: Object.fromEntries(oids.map((id,i)=>[`o${i}`, id])) }
                        );
                    }
                    if (oids.length) {
                        await queryInterface.sequelize.query(
                            `DELETE FROM ${qid(orderItemsTable)} WHERE ${qid('orderId')} IN (${oids.map((_,i)=>`:o${i}`).join(',')})`,
                            { replacements: Object.fromEntries(oids.map((id,i)=>[`o${i}`, id])) }
                        );
                        await queryInterface.sequelize.query(
                            `DELETE FROM ${qid(ordersTable)} WHERE ${qid('id')} IN (${oids.map((_,i)=>`:o${i}`).join(',')})`,
                            { replacements: Object.fromEntries(oids.map((id,i)=>[`o${i}`, id])) }
                        );
                    }
                }
            }
        } catch {}

        try {
            await queryInterface.sequelize.query(
                `DELETE FROM ${qid(productsTable)} WHERE ${qid('title')} IN (${titles.map((_,i)=>`:t${i}`).join(',')})`,
                { replacements: Object.fromEntries(titles.map((t,i)=>[`t${i}`, t])) }
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
                `DELETE FROM ${qid(usersTable)} WHERE ${qid('email')} IN (:a,:b,:c)`,
                { replacements: { a: 'admin@mineralcache.local', b: 'alice@example.com', c: 'bob@example.com' } }
            );
        } catch {}
    },
};
