// @ts-nocheck
const migration = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn("DemoRequests", "meetingUrl", {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: null,
        });
    },
    async down(queryInterface) {
        await queryInterface.removeColumn("DemoRequests", "meetingUrl");
    },
};
export default migration;

