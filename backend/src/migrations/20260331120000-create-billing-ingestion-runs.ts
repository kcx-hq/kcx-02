const hasTable = async (queryInterface: any, tableName: string) => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const migration = {
  async up(queryInterface: any, Sequelize: any) {
    if (await hasTable(queryInterface, "billing_ingestion_runs")) {
      return;
    }

    await queryInterface.createTable("billing_ingestion_runs", {
      id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      billing_source_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "billing_sources", key: "id" },
        onDelete: "CASCADE",
      },
      raw_billing_file_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "raw_billing_files", key: "id" },
        onDelete: "CASCADE",
      },
      status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "queued" },
      rows_read: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      rows_loaded: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      rows_failed: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      started_at: { type: Sequelize.DATE, allowNull: true },
      finished_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addIndex("billing_ingestion_runs", ["billing_source_id"], {
      name: "idx_billing_ingestion_runs_billing_source_id",
    });
    await queryInterface.addIndex("billing_ingestion_runs", ["raw_billing_file_id"], {
      name: "idx_billing_ingestion_runs_raw_billing_file_id",
    });
    await queryInterface.addIndex("billing_ingestion_runs", ["status"], {
      name: "idx_billing_ingestion_runs_status",
    });
  },

  async down(queryInterface: any) {
    await queryInterface.dropTable("billing_ingestion_runs");
  },
};

export default migration;
