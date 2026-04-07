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
const addBillingSourceFkIfPossible = async (queryInterface) => {
    if (!(await hasTable(queryInterface, "raw_billing_files")))
        return;
    if (!(await hasTable(queryInterface, "billing_sources")))
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
        // NOTE: provider -> cloud_provider_id is handled at table-definition level.
        // Assumption: dev environment / safe reset, so no in-place data backfill is implemented here.
        if (await hasTable(queryInterface, "raw_billing_files")) {
            return;
        }
        await queryInterface.createTable("raw_billing_files", {
            id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
            billing_source_id: {
                type: Sequelize.BIGINT,
                allowNull: true,
            },
            tenant_id: { type: Sequelize.STRING(100), allowNull: false },
            // migrated from provider string -> cloud_provider_id
            cloud_provider_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "cloud_providers", key: "id" },
            },
            source_type: { type: Sequelize.STRING(50), allowNull: false },
            setup_mode: { type: Sequelize.STRING(50), allowNull: false },
            original_file_name: { type: Sequelize.STRING(255), allowNull: false },
            original_file_path: { type: Sequelize.STRING(1000), allowNull: true },
            raw_storage_bucket: { type: Sequelize.STRING(255), allowNull: false },
            raw_storage_key: { type: Sequelize.STRING(1000), allowNull: false },
            file_format: { type: Sequelize.STRING(20), allowNull: false },
            file_size_bytes: { type: Sequelize.BIGINT, allowNull: true },
            checksum: { type: Sequelize.STRING(255), allowNull: true },
            status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "stored" },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
        });
        await queryInterface.addIndex("raw_billing_files", ["cloud_provider_id"], {
            name: "idx_raw_billing_files_cloud_provider_id",
        });
        await addBillingSourceFkIfPossible(queryInterface);
    },
    async down(queryInterface) {
        await queryInterface.dropTable("raw_billing_files");
    },
};
export default migration;




