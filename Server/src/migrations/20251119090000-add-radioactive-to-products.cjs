'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        await queryInterface.addColumn('products', 'radioactive', {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });

        await queryInterface.addIndex('products', ['radioactive']);
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('products', ['radioactive']);
        await queryInterface.removeColumn('products', 'radioactive');
    },
};
