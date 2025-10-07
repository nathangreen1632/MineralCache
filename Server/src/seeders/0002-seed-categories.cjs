/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(q) {
        const now = new Date();
        const rows = [
            // homeOrder follows your final rotation order
            { name: 'Artifacts',      slug: 'artifacts',       homeOrder: 1,  imageKey: 'artifacts.jpg' },
            { name: 'Agates',         slug: 'agates',          homeOrder: 2,  imageKey: 'agates.jpg' },
            { name: 'Cabochons',      slug: 'cabochons',       homeOrder: 3,  imageKey: 'cabochons.jpg' },
            { name: 'Crystals',       slug: 'crystals',        homeOrder: 4,  imageKey: 'crystals.jpg' },
            { name: 'Dinosaur Bone',  slug: 'dinosaur-bone',   homeOrder: 5,  imageKey: 'dinosaur-bone.jpg' },
            { name: 'Fossils',        slug: 'fossils',         homeOrder: 6,  imageKey: 'fossils.jpg' },
            { name: 'Gemstones',      slug: 'gemstones',       homeOrder: 7,  imageKey: 'gemstones.jpg' },
            { name: 'Petrified Wood', slug: 'petrified-wood',  homeOrder: 8,  imageKey: 'petrified-wood.jpg' },
            { name: 'Rough',          slug: 'rough',           homeOrder: 9,  imageKey: 'rough.jpg' },
            { name: 'Apparel',        slug: 'apparel',         homeOrder: 10, imageKey: 'apparel.jpg' },
            { name: 'Jewelry',        slug: 'jewelry',         homeOrder: 11, imageKey: 'jewelry.jpg' },
            { name: 'Display Bases',  slug: 'display-bases',   homeOrder: 12, imageKey: 'display-bases.jpg' },
        ].map((r) => ({ ...r, active: true, createdAt: now, updatedAt: now }));

        await q.bulkInsert('categories', rows);
    },

    async down(q) {
        await q.bulkDelete('categories', null);
    },
};
