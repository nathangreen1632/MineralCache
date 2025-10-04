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
    const existingId = await selectId(qi, table, whereObj);
    if (existingId) return existingId;
    try { await qi.bulkInsert(table, [row], { ignoreDuplicates: true }); } catch {}
    return selectId(qi, table, whereObj);
}
function staticBcryptHash() { return '$2b$10$K/VXqpA3mYQF2rK5N3D9euq8yFSAkWcO2d2Yj6hH6lYx2rN6GmB1S'; } // Admin123!
function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function priceAtPurchaseCents(pRow) { const sale = Number(pRow?.salePriceCents ?? 0); const base = Number(pRow?.priceCents ?? 0); return sale > 0 ? sale : base; }
function rnd(...xs) { return xs[Math.floor(Math.random() * xs.length)]; }
function randDigits(len) { return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join(''); }

/* ───────── seeder ───────── */
module.exports = {
    /** @param {import('sequelize').QueryInterface} queryInterface */
    async up(queryInterface) {
        /* tables (flexible name resolution) */
        const usersTable        = await resolveTable(queryInterface, ['users','Users','app_users']);
        const vendorsTable      = await resolveTable(queryInterface, ['vendors','Vendors']);
        const productsTable     = await resolveTable(queryInterface, ['products','Products']);
        const ordersTable       = await resolveTable(queryInterface, ['orders','Orders']);
        const orderItemsTable   = await resolveTable(queryInterface, ['order_items','OrderItems','orderItems']);
        const orderVendorsTable = await resolveTable(queryInterface, ['order_vendors','OrderVendors','orderVendors']);
        const paymentsTable     = await resolveTable(queryInterface, ['payments','order_payments','Payments','OrderPayments']);
        const addressesTable    = await resolveTable(queryInterface, ['addresses','order_addresses','Addresses','OrderAddresses']);
        const ledgerTable       = await resolveTable(queryInterface, ['ledger','order_vendor_ledger','Ledgers']);
        const adminSettingsTbl  = await resolveTable(queryInterface, ['admin_settings','AdminSettings','settings']);
        const shipRulesTable    = await resolveTable(queryInterface, ['shipping_rules','vendor_shipping_rules','ShippingRules']);

        if (!usersTable || !vendorsTable || !productsTable) {
            console.warn('[seed] required tables missing (users/vendors/products)'); return;
        }

        /* column/meta sets */
        const userCols        = await getColumns(queryInterface, usersTable);
        const vendorCols      = await getColumns(queryInterface, vendorsTable);
        const productCols     = await getColumns(queryInterface, productsTable);
        const orderCols       = ordersTable ? await getColumns(queryInterface, ordersTable) : new Set();
        const itemCols        = orderItemsTable ? await getColumns(queryInterface, orderItemsTable) : new Set();
        const orderVendorCols = orderVendorsTable ? await getColumns(queryInterface, orderVendorsTable) : new Set();
        const paymentCols     = paymentsTable ? await getColumns(queryInterface, paymentsTable) : new Set();
        const addressCols     = addressesTable ? await getColumns(queryInterface, addressesTable) : new Set();
        const ledgerCols      = ledgerTable ? await getColumns(queryInterface, ledgerTable) : new Set();
        const settingsCols    = adminSettingsTbl ? await getColumns(queryInterface, adminSettingsTbl) : new Set();
        const shipRulesCols   = shipRulesTable ? await getColumns(queryInterface, shipRulesTable) : new Set();

        const vendorMeta      = await getTableMeta(queryInterface, vendorsTable);
        const productMeta     = await getTableMeta(queryInterface, productsTable);
        const orderMeta       = ordersTable ? await getTableMeta(queryInterface, ordersTable) : null;
        const paymentMeta     = paymentsTable ? await getTableMeta(queryInterface, paymentsTable) : null;
        const orderVendorMeta = orderVendorsTable ? await getTableMeta(queryInterface, orderVendorsTable) : null;
        const ledgerMeta      = ledgerTable ? await getTableMeta(queryInterface, ledgerTable) : null;

        const ts = new Date();

        /* ───────── Admin settings (optional) ───────── */
        if (adminSettingsTbl) {
            // insert a single row if table looks empty
            try {
                const [rows] = await queryInterface.sequelize.query(`SELECT COUNT(1)::int AS c FROM ${qid(adminSettingsTbl)}`);
                const count = Array.isArray(rows) && rows[0]?.c ? Number(rows[0].c) : 0;
                if (count === 0) {
                    const row = narrowToColumns({
                        commission_bps:  settingsCols.has('commission_bps') ? 800 : undefined,  // 8%
                        min_fee_cents:   settingsCols.has('min_fee_cents')  ? 75  : undefined,  // $0.75
                        stripe_enabled:  settingsCols.has('stripe_enabled') ? false : undefined,
                        currency:        settingsCols.has('currency')       ? 'usd' : undefined,
                        ship_flat_cents: settingsCols.has('ship_flat_cents')? 1200 : undefined,
                        ship_per_item_cents: settingsCols.has('ship_per_item_cents') ? 0 : undefined,
                        ship_per_vendor_cents: settingsCols.has('ship_per_vendor_cents') ? 0 : undefined,
                        email_from:      settingsCols.has('email_from')     ? 'no-reply@mineralcache.local' : undefined,
                        brand_name:      settingsCols.has('brand_name')     ? 'Mineral Cache' : undefined,
                        tax_rate_bps:    settingsCols.has('tax_rate_bps')   ? 0 : undefined,
                        tax_label:       settingsCols.has('tax_label')      ? 'Sales Tax' : undefined,
                        createdAt:       settingsCols.has('createdAt')      ? ts : undefined,
                        updatedAt:       settingsCols.has('updatedAt')      ? ts : undefined,
                    }, settingsCols);
                    try { await queryInterface.bulkInsert(adminSettingsTbl, [row]); } catch {}
                }
            } catch {}
        }

        /* ───────── users ───────── */
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
        const aliceId   = await seedBuyer('alice@example.com',   'Alice Buyer');
        const bobId     = await seedBuyer('bob@example.com',     'Bob Buyer');
        const charlieId = await seedBuyer('charlie@example.com', 'Charlie Buyer');
        const doraId    = await seedBuyer('dora@example.com',    'Dora Buyer');

        /* vendor owners */
        async function seedVendorOwner(email, name) {
            const row = narrowToColumns({
                email,
                role: userCols.has('role') ? 'vendor' : undefined,
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
        const v1Owner = await seedVendorOwner('owner@cascade-minerals.local',  'Cascade Owner');
        const v2Owner = await seedVendorOwner('owner@desert-peak.local',       'Desert Peak Owner');
        const v3Owner = await seedVendorOwner('owner@northern-lights.local',   'Northern Lights Owner');

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
        const aliceAddressId   = await seedAddress(aliceId,   'Alice Buyer',   '101 Main St', 'Bend',  'OR', '97701', 'US');
        const bobAddressId     = await seedAddress(bobId,     'Bob Buyer',     '77 Pine Ave', 'Boise', 'ID', '83702', 'US');
        const charlieAddressId = await seedAddress(charlieId, 'Charlie Buyer', '12 North Rd','Helena','MT', '59601', 'US');
        const doraAddressId    = await seedAddress(doraId,    'Dora Buyer',    '9 Lake Dr',  'Reno',  'NV', '89501', 'US');

        /* ───────── vendors ───────── */
        const approvedVal = pickEnumValue(vendorMeta, 'approvalStatus', ['approved','active','enabled']);
        async function seedVendor({ slug, displayName, ownerUserId }) {
            const row = narrowToColumns({
                slug,
                displayName,
                name: vendorCols.has('name') ? displayName : undefined,
                ownerUserId: vendorCols.has('ownerUserId') ? ownerUserId : undefined,
                userId:      vendorCols.has('userId') ? ownerUserId : undefined,
                approvalStatus: vendorCols.has('approvalStatus') ? approvedVal : undefined,
                approvedAt:     vendorCols.has('approvedAt') ? ts : undefined,
                approvedBy:     vendorCols.has('approvedBy') ? adminId : undefined,
                country: vendorCols.has('country') ? 'US' : undefined,
                createdAt: vendorCols.has('createdAt') ? ts : undefined,
                updatedAt: vendorCols.has('updatedAt') ? ts : undefined,
            }, vendorCols);
            const id = await upsertAndGetId(queryInterface, vendorsTable, { slug }, row);

            // shipping rule (optional)
            if (shipRulesTable) {
                const where = shipRulesCols.has('vendorId') ? { vendorId: id } : {};
                const sr = narrowToColumns({
                    vendorId: shipRulesCols.has('vendorId') ? id : undefined,
                    domesticFlatCents: shipRulesCols.has('domesticFlatCents') ? 1200 : undefined,
                    perItemExtraCents: shipRulesCols.has('perItemExtraCents') ? 0 : undefined,
                    freeThresholdCents: shipRulesCols.has('freeThresholdCents') ? 0 : undefined,
                    active: shipRulesCols.has('active') ? true : undefined,
                    is_default_global: shipRulesCols.has('is_default_global') ? false : undefined,
                    label: shipRulesCols.has('label') ? 'Default Domestic' : undefined,
                    priority: shipRulesCols.has('priority') ? 1 : undefined,
                    createdAt: shipRulesCols.has('createdAt') ? ts : undefined,
                    updatedAt: shipRulesCols.has('updatedAt') ? ts : undefined,
                }, shipRulesCols);
                await upsertAndGetId(queryInterface, shipRulesTable, where, sr);
            }
            return id;
        }

        const vendors = [
            { slug: 'cascade-minerals',   displayName: 'Cascade Minerals',   ownerUserId: v1Owner },
            { slug: 'desert-peak',        displayName: 'Desert Peak Minerals', ownerUserId: v2Owner },
            { slug: 'northern-lights',    displayName: 'Northern Lights Minerals', ownerUserId: v3Owner },
        ];
        const vendorIds = [];
        for (const v of vendors) vendorIds.push(await seedVendor(v));

        /* ───────── products (6 per vendor) ───────── */
        const conditionVal = pickEnumValue(productMeta, 'condition', ['pristine','excellent','very_good','good','fine','mint']);
        const baseProducts = [
            { title:'Rhodochrosite with Quartz', species:'Rhodochrosite', locality:'Sweet Home Mine, Park County, Colorado, USA', dims:{L:5,W:4,H:3}, weightG:120, priceCents:22000, salePriceCents:19900 },
            { title:'Fluorite Octahedron',       species:'Fluorite',      locality:'Elmwood Mine, Tennessee, USA',               dims:{L:6,W:5,H:4}, weightG:150, priceCents:18000, salePriceCents:null   },
            { title:'Quartz Cluster',             species:'Quartz',        locality:'Herkimer County, New York, USA',            dims:{L:7,W:5,H:4}, weightG:210, priceCents: 9500, salePriceCents: 8900  },
            { title:'Barite on Galena',           species:'Barite',        locality:'Cave-in-Rock, Illinois, USA',               dims:{L:8,W:6,H:5}, weightG:320, priceCents:26000, salePriceCents:null   },
            { title:'Aquamarine Crystal',         species:'Beryl var. Aquamarine', locality:'Shigar Valley, Gilgit-Baltistan, Pakistan', dims:{L:5,W:2.5,H:2.5}, weightG:75, priceCents:28500, salePriceCents:25900 },
            { title:'Vanadinite on Matrix',       species:'Vanadinite',    locality:'Mibladen, Morocco',                          dims:{L:6,W:5,H:4}, weightG:190, priceCents:14000, salePriceCents:null   },
        ];

        // Map vendorId -> [{id, title, row}]
        const productMap = new Map();

        async function seedProductForVendor(vendorId, displayVendor, p) {
            const title = `${p.title} — ${displayVendor}`;
            const where = { title };
            const existingId = await selectId(queryInterface, productsTable, where);
            if (existingId) return { id: existingId, title };

            const slug = `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`;
            const row = narrowToColumns({
                vendorId,
                title,
                name: productCols.has('name') ? title : undefined,
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
                status: productCols.has('status') ? pickEnumValue(productMeta, 'status', ['live','active','available','published']) : undefined,
                createdAt: productCols.has('createdAt') ? ts : undefined,
                updatedAt: productCols.has('updatedAt') ? ts : undefined,
            }, productCols);

            const id = await upsertAndGetId(queryInterface, productsTable, where, row);
            return { id, title };
        }

        for (let i = 0; i < vendors.length; i++) {
            const v = vendors[i];
            const vid = vendorIds[i];
            const arr = [];
            for (const p of baseProducts) {
                arr.push(await seedProductForVendor(vid, v.displayName, p));
            }
            productMap.set(vid, arr);
        }

        /* ───────── cleanup old demo orders for involved buyers (repeatable seeds) ───────── */
        if (ordersTable && orderItemsTable) {
            try {
                const buyerIds = [aliceId, bobId, charlieId, doraId].filter(Boolean);
                if (buyerIds.length) {
                    const [orderRows] = await queryInterface.sequelize.query(
                        `SELECT ${qid('id')} FROM ${qid(ordersTable)} WHERE `
                        + (orderCols.has('buyerUserId') && orderCols.has('userId')
                            ? `(${qid('buyerUserId')} IN (:a,:b,:c,:d) OR ${qid('userId')} IN (:a,:b,:c,:d))`
                            : orderCols.has('buyerUserId')
                                ? `${qid('buyerUserId')} IN (:a,:b,:c,:d)`
                                : orderCols.has('userId')
                                    ? `${qid('userId')} IN (:a,:b,:c,:d)` : '1=2'),
                        { replacements: { a: buyerIds[0] ?? -1, b: buyerIds[1] ?? -1, c: buyerIds[2] ?? -1, d: buyerIds[3] ?? -1 } }
                    );
                    const oids = (Array.isArray(orderRows) ? orderRows.map(r => r.id) : []).filter(Boolean);
                    if (oids.length) {
                        if (ledgerTable) {
                            await queryInterface.sequelize.query(
                                `DELETE FROM ${qid(ledgerTable)} WHERE ${qid('orderVendorId')} IN (SELECT ${qid('id')} FROM ${qid(orderVendorsTable)} WHERE ${qid('orderId')} IN (${oids.map((_,i)=>`:o${i}`).join(',')}))`,
                                { replacements: Object.fromEntries(oids.map((id,i)=>[`o${i}`, id])) }
                            );
                        }
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

        /* ───────── orders (3 paid + 2 shipped + 2 refunded per vendor) ───────── */
        if (!ordersTable || !orderItemsTable) { console.warn('[seed] orders/order_items tables not found'); return; }

        const statusPaid     = pickEnumValue(orderMeta, 'status', ['paid','succeeded','completed','processing']);
        const statusNew      = pickEnumValue(orderMeta, 'status', ['new','created','pending']);
        const statusShipped  = pickEnumValue(orderMeta, 'status', ['shipped','fulfilled','sent','out_for_delivery','processing']);
        const statusRefunded = pickEnumValue(orderMeta, 'status', ['refunded','cancelled','canceled']);
        const payOk          = pickEnumValue(paymentMeta, 'status', ['succeeded','paid','completed']);
        const payRefunded    = pickEnumValue(paymentMeta, 'status', ['refunded','partially_refunded','reversed','failed']);

        const platformPct = 0.08;  // 8%
        const platformMin = 75;    // $0.75
        const feeFor = (subtotal) => Math.max(Math.round(subtotal * platformPct), platformMin);

        const carriers = ['usps','ups','fedex','dhl'];

        async function fetchProductRow(id) {
            const [rows] = await queryInterface.sequelize.query(
                `SELECT * FROM ${qid(productsTable)} WHERE ${qid('id')} = :id LIMIT 1`, { replacements: { id } }
            );
            return Array.isArray(rows) ? rows[0] : null;
        }

        async function ensureOrderVendorRow(orderId, vendorId, amounts, kind) {
            if (!orderVendorsTable) return null;

            const payoutEligible = pickEnumValue(orderVendorMeta, 'payoutStatus',
                kind === 'refunded'
                    ? ['hold','refunded','cancelled','canceled']
                    : kind === 'shipped'
                        ? ['queued','eligible','ready','pending','paid']
                        : ['eligible','pending','ready','queued','paid']);

            const ovRow = narrowToColumns({
                orderId, vendorId,
                subtotalCents:    orderVendorCols.has('subtotalCents') ? amounts.subtotal : undefined,
                shippingCents:    orderVendorCols.has('shippingCents') ? amounts.shipping : undefined,
                taxCents:         orderVendorCols.has('taxCents') ? amounts.tax : undefined,
                platformFeeCents: orderVendorCols.has('platformFeeCents') ? amounts.fee : undefined,
                totalCents:       orderVendorCols.has('totalCents') ? (amounts.subtotal + amounts.shipping + amounts.tax) : undefined,
                payoutStatus:     orderVendorCols.has('payoutStatus') ? payoutEligible : undefined,
                vendorGrossCents: orderVendorCols.has('vendorGrossCents') ? amounts.subtotal : undefined,
                vendorFeeCents:   orderVendorCols.has('vendorFeeCents')   ? amounts.fee : undefined,
                vendorNetCents:   orderVendorCols.has('vendorNetCents')   ? (amounts.subtotal - amounts.fee) : undefined,
                transferId:       orderVendorCols.has('transferId') ? (kind !== 'refunded' ? `tr_${randDigits(14)}` : null) : undefined,
                shippedAt:        orderVendorCols.has('shippedAt') && kind === 'shipped' ? new Date() : undefined,
                deliveredAt:      orderVendorCols.has('deliveredAt') && kind === 'delivered' ? new Date() : undefined,
                createdAt:        orderVendorCols.has('createdAt') ? ts : undefined,
                updatedAt:        orderVendorCols.has('updatedAt') ? ts : undefined,
            }, orderVendorCols);

            const whereOV = { orderId, ...(orderVendorCols.has('vendorId') ? { vendorId } : {}) };
            const ovId = await upsertAndGetId(queryInterface, orderVendorsTable, whereOV, ovRow);

            // optional ledger entry for payouts
            if (ledgerTable && ovId) {
                const ledgerType = pickEnumValue(ledgerMeta, 'type', ['payout','transfer','credit','debit']);
                const amount = (amounts.subtotal - amounts.fee);
                const ledgerRow = narrowToColumns({
                    orderVendorId: ovId,
                    type: ledgerType,
                    amountCents: ledgerCols.has('amountCents') ? (kind === 'refunded' ? -Math.abs(amount) : Math.abs(amount)) : undefined,
                    stripeRef:    ledgerCols.has('stripeRef') ? (ovRow.transferId || null) : undefined,
                    notes:        ledgerCols.has('notes') ? (kind === 'refunded' ? 'Refund adjustment' : 'Payout ready/queued') : undefined,
                    createdAt:    ledgerCols.has('createdAt') ? ts : undefined,
                    updatedAt:    ledgerCols.has('updatedAt') ? ts : undefined,
                }, ledgerCols);

                // idempotent-ish: (orderVendorId, type)
                const whereL = {};
                if (ledgerCols.has('orderVendorId')) whereL.orderVendorId = ovId;
                const lid = await selectId(queryInterface, ledgerTable, whereL);
                if (!lid) { try { await queryInterface.bulkInsert(ledgerTable, [ledgerRow], { ignoreDuplicates: true }); } catch {} }
            }

            return ovId;
        }

        async function seedOrder({ vendorId, buyerUserId, addressId, email, productIds, kind }) {
            // Build items & compute totals
            const prepared = [];
            let subtotal = 0;
            for (const { productId, qty } of productIds) {
                const p = await fetchProductRow(productId);
                if (!p) continue;
                const unit = priceAtPurchaseCents(p);
                subtotal += unit * qty;
                prepared.push({ productId, qty, unitCents: unit, pRow: p });
            }

            const shippingCents = 1200;
            const taxCents = 0;
            const totalCents = subtotal + shippingCents + taxCents;
            const platformFeeCents = feeFor(subtotal);

            const orderRow = narrowToColumns({
                buyerUserId: orderCols.has('buyerUserId') ? buyerUserId : undefined,
                userId:      orderCols.has('userId')      ? buyerUserId : undefined,
                email:       orderCols.has('email') ? email : undefined,

                shippingName:     orderCols.has('shippingName') ? (email?.split('@')[0] || 'Buyer') : undefined,
                shippingAddress1: orderCols.has('shippingAddress1') ? 'Demo Address 1' : undefined,
                shippingCity:     orderCols.has('shippingCity') ? 'Bend' : undefined,
                shippingRegion:   orderCols.has('shippingRegion') ? 'OR' : undefined,
                shippingPostal:   orderCols.has('shippingPostal') ? '97701' : undefined,
                shippingCountry:  orderCols.has('shippingCountry') ? 'US' : undefined,

                addressId:        orderCols.has('addressId') ? addressId : undefined,

                subtotalCents:    orderCols.has('subtotalCents') ? subtotal : undefined,
                shippingCents:    orderCols.has('shippingCents') ? shippingCents : undefined,
                taxCents:         orderCols.has('taxCents') ? taxCents : undefined,
                totalCents:       orderCols.has('totalCents') ? totalCents : undefined,
                platformFeeCents: orderCols.has('platformFeeCents') ? platformFeeCents : undefined,
                platformFeePct:   orderCols.has('platformFeePct') ? platformPct : undefined,
                commissionPct:    orderCols.has('commissionPct') ? platformPct : undefined,
                commissionCents:  orderCols.has('commissionCents') ? platformFeeCents : undefined,

                status: orderCols.has('status')
                    ? (kind === 'refunded' ? statusRefunded : kind === 'shipped' ? statusShipped : statusPaid || statusNew)
                    : undefined,

                paidAt:     orderCols.has('paidAt')      && kind !== 'new' ? new Date() : undefined,
                refundedAt: orderCols.has('refundedAt')  && kind === 'refunded' ? new Date() : undefined,

                createdAt: orderCols.has('createdAt') ? ts : undefined,
                updatedAt: orderCols.has('updatedAt') ? ts : undefined,
            }, orderCols);

            // uniqueness so re-runs don't duplicate
            const whereForId = (() => {
                const w = {};
                if (orderCols.has('buyerUserId')) w['buyerUserId'] = buyerUserId; else if (orderCols.has('userId')) w['userId'] = buyerUserId;
                if (orderCols.has('totalCents')) w['totalCents'] = totalCents;
                if (orderCols.has('subtotalCents')) w['subtotalCents'] = subtotal;
                if (orderCols.has('status')) w['status'] = orderRow.status;
                return w;
            })();

            const orderId = await upsertAndGetId(queryInterface, ordersTable, whereForId, orderRow);

            // items (+ shipping/refund fields on items if present)
            for (const it of prepared) {
                const p = it.pRow || {};
                const shipCarrier = rnd(...carriers);
                const shipTrack   = `${shipCarrier.toUpperCase()}-${randDigits(16)}`;
                const shippedAt   = kind === 'shipped' ? new Date() : null;

                const itemRow = narrowToColumns({
                    orderId,
                    productId: it.productId,
                    vendorId,

                    quantity:        itemCols.has('quantity') ? it.qty : undefined,
                    qty:             itemCols.has('qty') ? it.qty : undefined,
                    unitPriceCents:  itemCols.has('unitPriceCents') ? it.unitCents : undefined,
                    priceCents:      itemCols.has('priceCents') ? it.unitCents : undefined,
                    lineTotalCents:  itemCols.has('lineTotalCents') ? (it.unitCents * it.qty) : undefined,

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
                    vendorDisplayNameSnapshot: itemCols.has('vendorDisplayNameSnapshot') ? vendors[vendorIds.indexOf(vendorId)].displayName : undefined,
                    vendorNameSnapshot:        itemCols.has('vendorNameSnapshot')        ? vendors[vendorIds.indexOf(vendorId)].displayName : undefined,
                    vendorSlugSnapshot:        itemCols.has('vendorSlugSnapshot')        ? vendors[vendorIds.indexOf(vendorId)].slug : undefined,
                    productSlugSnapshot:       itemCols.has('productSlugSnapshot')       ? (p.slug ?? null) : undefined,

                    refundedQty:   itemCols.has('refundedQty')   ? (kind === 'refunded' ? it.qty : 0) : undefined,
                    discountCents: itemCols.has('discountCents') ? 0 : undefined,
                    discountPct:   itemCols.has('discountPct')   ? 0 : undefined,
                    taxCents:      itemCols.has('taxCents')      ? 0 : undefined,
                    shippingCents: itemCols.has('shippingCents') ? 0 : undefined,
                    feeCents:      itemCols.has('feeCents')      ? 0 : undefined,
                    isRefunded:    itemCols.has('isRefunded')    ? (kind === 'refunded') : undefined,
                    isCancelled:   itemCols.has('isCancelled')   ? false : undefined,

                    ship_carrier:   itemCols.has('ship_carrier')   ? shipCarrier : undefined,
                    ship_tracking:  itemCols.has('ship_tracking')  ? shipTrack   : undefined,
                    shipped_at:     itemCols.has('shipped_at')     ? shippedAt   : undefined,
                    delivered_at:   itemCols.has('delivered_at')   ? null        : undefined,

                    createdAt: itemCols.has('createdAt') ? ts : undefined,
                    updatedAt: itemCols.has('updatedAt') ? ts : undefined,
                }, itemCols);

                const whereItem = {};
                if (itemCols.has('orderId')) whereItem.orderId = orderId;
                if (itemCols.has('productId')) whereItem.productId = it.productId;
                const exists = Object.keys(whereItem).length ? await selectId(queryInterface, orderItemsTable, whereItem) : null;
                if (!exists) { try { await queryInterface.bulkInsert(orderItemsTable, [itemRow], { ignoreDuplicates: true }); } catch {} }
            }

            // vendor split + payout snapshot
            await ensureOrderVendorRow(orderId, vendorId, { subtotal, shipping: shippingCents, tax: taxCents, fee: platformFeeCents }, kind);

            // payment
            if (paymentsTable) {
                const payRow = narrowToColumns({
                    orderId,
                    amountCents: paymentCols.has('amountCents') ? totalCents : undefined,
                    processor:   paymentCols.has('processor') ? 'stripe' : undefined,
                    status:      paymentCols.has('status') ? (kind === 'refunded' ? (payRefunded || payOk) : payOk) : undefined,
                    createdAt:   paymentCols.has('createdAt') ? ts : undefined,
                    updatedAt:   paymentCols.has('updatedAt') ? ts : undefined,
                }, paymentCols);
                const payExists = await selectId(queryInterface, paymentsTable, { orderId });
                if (!payExists) { try { await queryInterface.bulkInsert(paymentsTable, [payRow], { ignoreDuplicates: true }); } catch {} }
            }
        }

        // Per vendor: create 3 paid, 2 shipped, 2 refunded orders
        const buyers = [
            { id: aliceId,   addr: aliceAddressId,   email: 'alice@example.com' },
            { id: bobId,     addr: bobAddressId,     email: 'bob@example.com' },
            { id: charlieId, addr: charlieAddressId, email: 'charlie@example.com' },
            { id: doraId,    addr: doraAddressId,    email: 'dora@example.com' },
        ];

        let buyerIdx = 0;
        function nextBuyer() { const b = buyers[buyerIdx % buyers.length]; buyerIdx += 1; return b; }

        for (const vid of vendorIds) {
            const prods = productMap.get(vid) || [];
            const pick = (n) => prods.slice(0, n).map((x, i) => ({ productId: x.id, qty: (i % 2) + 1 }));

            // 3 PAID
            for (let i = 0; i < 3; i++) {
                const b = nextBuyer();
                await seedOrder({ vendorId: vid, buyerUserId: b.id, addressId: b.addr, email: b.email, productIds: pick(2 + (i % 2)), kind: 'paid' });
            }

            // 2 SHIPPED
            for (let i = 0; i < 2; i++) {
                const b = nextBuyer();
                await seedOrder({ vendorId: vid, buyerUserId: b.id, addressId: b.addr, email: b.email, productIds: pick(1 + (i % 2)), kind: 'shipped' });
            }

            // 2 REFUNDED
            for (let i = 0; i < 2; i++) {
                const b = nextBuyer();
                await seedOrder({ vendorId: vid, buyerUserId: b.id, addressId: b.addr, email: b.email, productIds: pick(1), kind: 'refunded' });
            }
        }
    },

    async down(queryInterface) {
        const usersTable        = await resolveTable(queryInterface, ['users','Users','app_users']);
        const vendorsTable      = await resolveTable(queryInterface, ['vendors','Vendors']);
        const productsTable     = await resolveTable(queryInterface, ['products','Products']);
        const ordersTable       = await resolveTable(queryInterface, ['orders','Orders']);
        const orderItemsTable   = await resolveTable(queryInterface, ['order_items','OrderItems','orderItems']);
        const orderVendorsTable = await resolveTable(queryInterface, ['order_vendors','OrderVendors','orderVendors']);
        const paymentsTable     = await resolveTable(queryInterface, ['payments','order_payments','Payments','OrderPayments']);
        const ledgerTable       = await resolveTable(queryInterface, ['ledger','order_vendor_ledger','Ledgers']);
        const shipRulesTable    = await resolveTable(queryInterface, ['shipping_rules','vendor_shipping_rules','ShippingRules']);

        const vendorSlugs = ['cascade-minerals','desert-peak','northern-lights'];

        // collect product IDs for these vendors
        let vendorIds = [];
        try {
            const [vrows] = await queryInterface.sequelize.query(
                `SELECT ${qid('id')}, ${qid('slug')} FROM ${qid(vendorsTable)} WHERE ${qid('slug')} IN (${vendorSlugs.map((_,i)=>`:s${i}`).join(',')})`,
                { replacements: Object.fromEntries(vendorSlugs.map((slug,i)=>[`s${i}`, slug])) }
            );
            vendorIds = Array.isArray(vrows) ? vrows.map(r => r.id) : [];
        } catch {}

        let prodIds = [];
        try {
            if (vendorIds.length) {
                const [prows] = await queryInterface.sequelize.query(
                    `SELECT ${qid('id')} FROM ${qid(productsTable)} WHERE ${qid('vendorId')} IN (${vendorIds.map((_,i)=>`:v${i}`).join(',')})`,
                    { replacements: Object.fromEntries(vendorIds.map((id,i)=>[`v${i}`, id])) }
                );
                prodIds = Array.isArray(prows) ? prows.map(r => r.id) : [];
            }
        } catch {}

        // delete orders referencing those products
        try {
            if (ordersTable && orderItemsTable && prodIds.length) {
                const [orderRows] = await queryInterface.sequelize.query(
                    `SELECT DISTINCT ${qid('orderId')} AS id FROM ${qid(orderItemsTable)} WHERE ${qid('productId')} IN (${prodIds.map((_,i)=>`:p${i}`).join(',')})`,
                    { replacements: Object.fromEntries(prodIds.map((id,i)=>[`p${i}`, id])) }
                );
                const oids = Array.isArray(orderRows) ? orderRows.map(r => r.id) : [];
                if (oids.length) {
                    if (ledgerTable && orderVendorsTable) {
                        await queryInterface.sequelize.query(
                            `DELETE FROM ${qid(ledgerTable)} WHERE ${qid('orderVendorId')} IN (SELECT ${qid('id')} FROM ${qid(orderVendorsTable)} WHERE ${qid('orderId')} IN (${oids.map((_,i)=>`:o${i}`).join(',')}))`,
                            { replacements: Object.fromEntries(oids.map((id,i)=>[`o${i}`, id])) }
                        );
                    }
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
        } catch {}

        // delete products
        try {
            if (prodIds.length) {
                await queryInterface.sequelize.query(
                    `DELETE FROM ${qid(productsTable)} WHERE ${qid('id')} IN (${prodIds.map((_,i)=>`:p${i}`).join(',')})`,
                    { replacements: Object.fromEntries(prodIds.map((id,i)=>[`p${i}`, id])) }
                );
            }
        } catch {}

        // delete shipping rules
        try {
            if (shipRulesTable && vendorIds.length) {
                await queryInterface.sequelize.query(
                    `DELETE FROM ${qid(shipRulesTable)} WHERE ${qid('vendorId')} IN (${vendorIds.map((_,i)=>`:v${i}`).join(',')})`,
                    { replacements: Object.fromEntries(vendorIds.map((id,i)=>[`v${i}`, id])) }
                );
            }
        } catch {}

        // delete vendors
        try {
            await queryInterface.sequelize.query(
                `DELETE FROM ${qid(vendorsTable)} WHERE ${qid('slug')} IN (${vendorSlugs.map((_,i)=>`:s${i}`).join(',')})`,
                { replacements: Object.fromEntries(vendorSlugs.map((slug,i)=>[`s${i}`, slug])) }
            );
        } catch {}

        // delete seeded users (admin + vendor owners + buyers)
        try {
            await queryInterface.sequelize.query(
                `DELETE FROM ${qid(usersTable)} WHERE ${qid('email')} IN (:a,:b,:c,:d,:e,:f,:g)`,
                { replacements: {
                        a: 'admin@mineralcache.local',
                        b: 'owner@cascade-minerals.local',
                        c: 'owner@desert-peak.local',
                        d: 'owner@northern-lights.local',
                        e: 'alice@example.com',
                        f: 'bob@example.com',
                        g: 'charlie@example.com',
                    } }
            );
            await queryInterface.sequelize.query(
                `DELETE FROM ${qid(usersTable)} WHERE ${qid('email')} = :dora`,
                { replacements: { dora: 'dora@example.com' } }
            );
        } catch {}
    },
};
