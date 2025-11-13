'use strict';

module.exports = {
    async up(queryInterface) {
        const table = 'order_vendor';
        const idx = 'order_vendor_order_vendor_uc';

        await queryInterface.sequelize.query(`
      DELETE FROM "${table}" t
      USING "${table}" d
      WHERE t.ctid < d.ctid
        AND t."orderId" = d."orderId"
        AND t."vendorId" = d."vendorId";
    `);

        const indexes = await queryInterface.showIndex(table).catch(() => []);
        const has = Array.isArray(indexes) && indexes.some(i => i.name === idx);
        if (!has) {
            await queryInterface.addIndex(table, ['orderId','vendorId'], { unique: true, name: idx });
        }
    },

    async down(queryInterface) {
        const table = 'order_vendor';
        const idx = 'order_vendor_order_vendor_uc';
        const indexes = await queryInterface.showIndex(table).catch(() => []);
        const has = Array.isArray(indexes) && indexes.some(i => i.name === idx);
        if (has) {
            await queryInterface.removeIndex(table, idx).catch(() => {});
        }
    }
};
