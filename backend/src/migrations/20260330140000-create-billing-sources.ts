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
const ensureRawBillingFilesFk = async (queryInterface) => {
    if (!(await hasTable(queryInterface, "raw_billing_files")))
        return;
    await queryInterface.sequelize.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_raw_billing_files_billing_source_id'
  ) THEN
    ALTER TABLE raw_billing_files
    ADD CONSTRAINT fk_raw_billing_files_billing_source_id
    FOREIGN KEY (billing_source_id)
    REFERENCES billing_sources(id)
    ON DELETE SET NULL;
  END IF;
END
$$;
`);
};
const migration = {
    async up(queryInterface, Sequelize) {
        if (await hasTable(queryInterface, "billing_sources")) {
            await ensureRawBillingFilesFk(queryInterface);
            return;
        }
        await queryInterface.createTable("billing_sources", {
            id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
            tenant_id: { type: Sequelize.STRING(100), allowNull: false },
            cloud_connection_id: { type: Sequelize.UUID, allowNull: true },
            cloud_provider_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "cloud_providers", key: "id" },
            },
            source_name: { type: Sequelize.STRING(255), allowNull: false },
            source_type: { type: Sequelize.STRING(50), allowNull: false },
            setup_mode: { type: Sequelize.STRING(50), allowNull: false },
            format: { type: Sequelize.STRING(20), allowNull: false },
            schema_type: { type: Sequelize.STRING(50), allowNull: false },
            bucket_name: { type: Sequelize.STRING(255), allowNull: true },
            path_prefix: { type: Sequelize.STRING(1000), allowNull: true },
            file_pattern: { type: Sequelize.STRING(255), allowNull: true },
            cadence: { type: Sequelize.STRING(50), allowNull: true },
            status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "draft" },
            last_validated_at: { type: Sequelize.DATE, allowNull: true },
            last_file_received_at: { type: Sequelize.DATE, allowNull: true },
            last_ingested_at: { type: Sequelize.DATE, allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
        });
        await queryInterface.addIndex("billing_sources", ["tenant_id"], { name: "idx_billing_sources_tenant_id" });
        await queryInterface.addIndex("billing_sources", ["status"], { name: "idx_billing_sources_status" });
        await queryInterface.addIndex("billing_sources", ["cloud_provider_id"], { name: "idx_billing_sources_provider_id" });
        await ensureRawBillingFilesFk(queryInterface);
    },
    async down(queryInterface) {
        await queryInterface.dropTable("billing_sources");
    },
};
export default migration;




