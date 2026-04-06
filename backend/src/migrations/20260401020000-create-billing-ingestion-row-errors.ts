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
    if (await hasTable(queryInterface, "billing_ingestion_row_errors")) {
      return;
    }

    await queryInterface.createTable("billing_ingestion_row_errors", {
      id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      ingestion_run_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "billing_ingestion_runs", key: "id" },
        onDelete: "CASCADE",
      },
      raw_billing_file_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "raw_billing_files", key: "id" },
        onDelete: "SET NULL",
      },
      row_number: { type: Sequelize.INTEGER, allowNull: true },
      error_code: { type: Sequelize.STRING(100), allowNull: true },
      error_message: { type: Sequelize.TEXT, allowNull: false },
      raw_row_json: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addIndex("billing_ingestion_row_errors", ["ingestion_run_id"], {
      name: "idx_billing_ingestion_row_errors_run_id",
    });
    await queryInterface.addIndex("billing_ingestion_row_errors", ["raw_billing_file_id"], {
      name: "idx_billing_ingestion_row_errors_raw_file_id",
    });
    await queryInterface.addIndex("billing_ingestion_row_errors", ["error_code"], {
      name: "idx_billing_ingestion_row_errors_error_code",
    });
  },

  async down(queryInterface) {
    if (!(await hasTable(queryInterface, "billing_ingestion_row_errors"))) {
      return;
    }
    await queryInterface.dropTable("billing_ingestion_row_errors");
  },
};

export default migration;



