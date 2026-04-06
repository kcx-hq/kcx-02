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
        if (await hasTable(queryInterface, "fact_cost_line_items")) {
            return;
        }
        await queryInterface.createTable("fact_cost_line_items", {
            id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
            tenant_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "tenants", key: "id" },
                onDelete: "CASCADE",
            },
            billing_source_id: {
                type: Sequelize.BIGINT,
                allowNull: true,
                references: { model: "billing_sources", key: "id" },
                onDelete: "SET NULL",
            },
            ingestion_run_id: {
                type: Sequelize.BIGINT,
                allowNull: true,
                references: { model: "billing_ingestion_runs", key: "id" },
                onDelete: "SET NULL",
            },
            provider_id: {
                type: Sequelize.BIGINT,
                allowNull: false,
                references: { model: "cloud_providers", key: "id" },
            },
            billing_account_key: { type: Sequelize.BIGINT, allowNull: true, references: { model: "dim_billing_account", key: "id" } },
            sub_account_key: { type: Sequelize.BIGINT, allowNull: true, references: { model: "dim_sub_account", key: "id" } },
            region_key: { type: Sequelize.BIGINT, allowNull: true, references: { model: "dim_region", key: "id" } },
            service_key: { type: Sequelize.BIGINT, allowNull: true, references: { model: "dim_service", key: "id" } },
            resource_key: { type: Sequelize.BIGINT, allowNull: true, references: { model: "dim_resource", key: "id" } },
            sku_key: { type: Sequelize.BIGINT, allowNull: true, references: { model: "dim_sku", key: "id" } },
            charge_key: { type: Sequelize.BIGINT, allowNull: true, references: { model: "dim_charge", key: "id" } },
            usage_date_key: { type: Sequelize.BIGINT, allowNull: true, references: { model: "dim_date", key: "id" } },
            billing_period_start_date_key: { type: Sequelize.BIGINT, allowNull: true, references: { model: "dim_date", key: "id" } },
            billing_period_end_date_key: { type: Sequelize.BIGINT, allowNull: true, references: { model: "dim_date", key: "id" } },
            billed_cost: { type: Sequelize.DECIMAL(18, 6), allowNull: true },
            effective_cost: { type: Sequelize.DECIMAL(18, 6), allowNull: true },
            list_cost: { type: Sequelize.DECIMAL(18, 6), allowNull: true },
            consumed_quantity: { type: Sequelize.DECIMAL(18, 6), allowNull: true },
            pricing_quantity: { type: Sequelize.DECIMAL(18, 6), allowNull: true },
            tags_json: { type: Sequelize.JSONB, allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
        });
        await queryInterface.addIndex("fact_cost_line_items", ["tenant_id"], { name: "idx_fact_cost_line_items_tenant_id" });
        await queryInterface.addIndex("fact_cost_line_items", ["provider_id"], { name: "idx_fact_cost_line_items_provider_id" });
        await queryInterface.addIndex("fact_cost_line_items", ["billing_source_id"], {
            name: "idx_fact_cost_line_items_billing_source_id",
        });
        await queryInterface.addIndex("fact_cost_line_items", ["ingestion_run_id"], {
            name: "idx_fact_cost_line_items_ingestion_run_id",
        });
        await queryInterface.addIndex("fact_cost_line_items", ["usage_date_key"], {
            name: "idx_fact_cost_line_items_usage_date_key",
        });
        await queryInterface.addIndex("fact_cost_line_items", ["billing_account_key"], {
            name: "idx_fact_cost_line_items_billing_account_key",
        });
        await queryInterface.addIndex("fact_cost_line_items", ["sub_account_key"], {
            name: "idx_fact_cost_line_items_sub_account_key",
        });
        await queryInterface.addIndex("fact_cost_line_items", ["region_key"], { name: "idx_fact_cost_line_items_region_key" });
        await queryInterface.addIndex("fact_cost_line_items", ["service_key"], { name: "idx_fact_cost_line_items_service_key" });
        await queryInterface.addIndex("fact_cost_line_items", ["resource_key"], {
            name: "idx_fact_cost_line_items_resource_key",
        });
        await queryInterface.addIndex("fact_cost_line_items", ["sku_key"], { name: "idx_fact_cost_line_items_sku_key" });
        await queryInterface.addIndex("fact_cost_line_items", ["charge_key"], { name: "idx_fact_cost_line_items_charge_key" });
    },
    async down(queryInterface) {
        if (!(await hasTable(queryInterface, "fact_cost_line_items"))) {
            return;
        }
        await queryInterface.dropTable("fact_cost_line_items");
    },
};
export default migration;




