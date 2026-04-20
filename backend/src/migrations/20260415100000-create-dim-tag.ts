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
        if (await hasTable(queryInterface, "dim_tag")) {
            return;
        }
        await queryInterface.createTable("dim_tag", {
            id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
            provider_id: {
                type: Sequelize.BIGINT,
                allowNull: false,
                references: { model: "cloud_providers", key: "id" },
                onDelete: "RESTRICT",
            },
            tenant_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "tenants", key: "id" },
                onDelete: "CASCADE",
            },
            tag_key: { type: Sequelize.STRING(100), allowNull: false },
            tag_value: { type: Sequelize.STRING(255), allowNull: false },
            normalized_key: { type: Sequelize.STRING(100), allowNull: false },
            normalized_value: { type: Sequelize.STRING(255), allowNull: false },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
        });
        await queryInterface.addConstraint("dim_tag", {
            type: "unique",
            fields: ["tenant_id", "provider_id", "normalized_key", "normalized_value"],
            name: "uq_dim_tag_tenant_provider_key_value",
        });
        await queryInterface.addIndex("dim_tag", ["tenant_id", "provider_id"], {
            name: "idx_dim_tag_tenant_provider",
        });
    },
    async down(queryInterface) {
        if (!(await hasTable(queryInterface, "dim_tag"))) {
            return;
        }
        await queryInterface.dropTable("dim_tag");
    },
};
export default migration;

