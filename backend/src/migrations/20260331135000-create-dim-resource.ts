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
        if (await hasTable(queryInterface, "dim_resource")) {
            return;
        }
        await queryInterface.createTable("dim_resource", {
            id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
            tenant_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "tenants", key: "id" },
                onDelete: "CASCADE",
            },
            provider_id: {
                type: Sequelize.BIGINT,
                allowNull: false,
                references: { model: "cloud_providers", key: "id" },
            },
            resource_id: { type: Sequelize.STRING(255), allowNull: false },
            resource_name: { type: Sequelize.STRING(255), allowNull: true },
            resource_type: { type: Sequelize.STRING(100), allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
        });
        await queryInterface.addConstraint("dim_resource", {
            type: "unique",
            fields: ["tenant_id", "provider_id", "resource_id"],
            name: "uq_dim_resource_tenant_provider_resource_id",
        });
        await queryInterface.addIndex("dim_resource", ["tenant_id", "provider_id"], {
            name: "idx_dim_resource_tenant_provider",
        });
    },
    async down(queryInterface) {
        if (!(await hasTable(queryInterface, "dim_resource"))) {
            return;
        }
        await queryInterface.dropTable("dim_resource");
    },
};
export default migration;




