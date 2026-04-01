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
        if (await hasTable(queryInterface, "dim_region")) {
            return;
        }
        await queryInterface.createTable("dim_region", {
            id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
            provider_id: {
                type: Sequelize.BIGINT,
                allowNull: false,
                references: { model: "cloud_providers", key: "id" },
            },
            region_id: { type: Sequelize.STRING(100), allowNull: true },
            region_name: { type: Sequelize.STRING(100), allowNull: false },
            availability_zone: { type: Sequelize.STRING(100), allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
        });
        await queryInterface.addConstraint("dim_region", {
            type: "unique",
            fields: ["provider_id", "region_id", "region_name", "availability_zone"],
            name: "uq_dim_region_provider_region_zone",
        });
        await queryInterface.addIndex("dim_region", ["provider_id"], { name: "idx_dim_region_provider_id" });
    },
    async down(queryInterface) {
        if (!(await hasTable(queryInterface, "dim_region"))) {
            return;
        }
        await queryInterface.dropTable("dim_region");
    },
};
export default migration;

