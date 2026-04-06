/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const hasTable = async (queryInterface, tableName) => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const migration = {
  async up(queryInterface, Sequelize) {
    const tableName = "billing_ingestion_run_files";

    if (!(await hasTable(queryInterface, tableName))) {
      await queryInterface.createTable(tableName, {
        id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
        ingestion_run_id: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: "billing_ingestion_runs", key: "id" },
          onDelete: "CASCADE",
        },
        raw_billing_file_id: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: "raw_billing_files", key: "id" },
          onDelete: "CASCADE",
        },
        file_role: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "data" },
        processing_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      });
    }

    await queryInterface.addIndex(tableName, ["ingestion_run_id"], {
      name: "idx_billing_ingestion_run_files_run_id",
    });

    await queryInterface.addIndex(tableName, ["raw_billing_file_id"], {
      name: "idx_billing_ingestion_run_files_raw_file_id",
    });

    await queryInterface.addIndex(tableName, ["ingestion_run_id", "raw_billing_file_id"], {
      unique: true,
      name: "uq_billing_ingestion_run_files_run_raw_file",
    });

    await queryInterface.addIndex(tableName, ["ingestion_run_id", "file_role", "processing_order"], {
      name: "idx_billing_ingestion_run_files_run_role_order",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("billing_ingestion_run_files");
  },
};

export default migration;
