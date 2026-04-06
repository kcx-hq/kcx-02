/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const hasTable = async (queryInterface, tableName) => {
    try {
        await queryInterface.describeTable(tableName);
        return true;
    }
    catch {
        return false;
    }
};
const migration = {
    async up(queryInterface, Sequelize) {
        if (await hasTable(queryInterface, "dim_charge")) {
            return;
        }
        await queryInterface.createTable("dim_charge", {
            id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
            charge_category: { type: Sequelize.STRING(100), allowNull: true },
            charge_class: { type: Sequelize.STRING(100), allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
        });
        await queryInterface.addConstraint("dim_charge", {
            type: "unique",
            fields: ["charge_category", "charge_class"],
            name: "uq_dim_charge_category_class",
        });
    },
    async down(queryInterface) {
        if (!(await hasTable(queryInterface, "dim_charge"))) {
            return;
        }
        await queryInterface.dropTable("dim_charge");
    },
};
export default migration;




