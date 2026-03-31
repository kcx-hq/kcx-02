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
        if (await hasTable(queryInterface, "dim_sku")) {
            return;
        }
        await queryInterface.createTable("dim_sku", {
            id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
            provider_id: {
                type: Sequelize.BIGINT,
                allowNull: false,
                references: { model: "cloud_providers", key: "id" },
            },
            sku_id: { type: Sequelize.STRING(255), allowNull: true },
            sku_price_id: { type: Sequelize.STRING(255), allowNull: true },
            pricing_category: { type: Sequelize.STRING(100), allowNull: true },
            pricing_unit: { type: Sequelize.STRING(100), allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
        });
        await queryInterface.addConstraint("dim_sku", {
            type: "unique",
            fields: ["provider_id", "sku_id", "sku_price_id", "pricing_category", "pricing_unit"],
            name: "uq_dim_sku_provider_sku_price_category_unit",
        });
        await queryInterface.addIndex("dim_sku", ["provider_id"], { name: "idx_dim_sku_provider_id" });
    },
    async down(queryInterface) {
        if (!(await hasTable(queryInterface, "dim_sku"))) {
            return;
        }
        await queryInterface.dropTable("dim_sku");
    },
};
export default migration;

