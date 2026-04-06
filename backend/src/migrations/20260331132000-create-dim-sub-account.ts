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
        if (await hasTable(queryInterface, "dim_sub_account")) {
            return;
        }
        await queryInterface.createTable("dim_sub_account", {
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
            sub_account_id: { type: Sequelize.STRING(100), allowNull: false },
            sub_account_name: { type: Sequelize.STRING(255), allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
        });
        await queryInterface.addConstraint("dim_sub_account", {
            type: "unique",
            fields: ["tenant_id", "provider_id", "sub_account_id"],
            name: "uq_dim_sub_account_tenant_provider_sub_account_id",
        });
        await queryInterface.addIndex("dim_sub_account", ["tenant_id", "provider_id"], {
            name: "idx_dim_sub_account_tenant_provider",
        });
    },
    async down(queryInterface) {
        if (!(await hasTable(queryInterface, "dim_sub_account"))) {
            return;
        }
        await queryInterface.dropTable("dim_sub_account");
    },
};
export default migration;




