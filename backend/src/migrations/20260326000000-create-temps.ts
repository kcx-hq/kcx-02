/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("Temps", {
            id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
        });
    },
    async down(queryInterface) {
        await queryInterface.dropTable("Temps");
    },
};
export default migration;




