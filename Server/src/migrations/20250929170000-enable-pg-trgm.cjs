// Server/src/migrations/20250929170000-enable-pg-trgm.cjs

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        // Safe if already present
        await queryInterface.sequelize.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
      DROP EXTENSION IF EXISTS pg_trgm;
    `);
    },
};
