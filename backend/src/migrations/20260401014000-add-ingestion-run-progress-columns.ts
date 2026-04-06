/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const hasColumn = async (queryInterface, tableName, columnName) => {
  try {
    const schema = await queryInterface.describeTable(tableName);
    return Boolean(schema?.[columnName]);
  } catch {
    return false;
  }
};

const migration = {
  async up(queryInterface, Sequelize) {
    const tableName = "billing_ingestion_runs";

    if (!(await hasColumn(queryInterface, tableName, "current_step"))) {
      await queryInterface.addColumn(tableName, "current_step", {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }

    if (!(await hasColumn(queryInterface, tableName, "progress_percent"))) {
      await queryInterface.addColumn(tableName, "progress_percent", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    if (!(await hasColumn(queryInterface, tableName, "status_message"))) {
      await queryInterface.addColumn(tableName, "status_message", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!(await hasColumn(queryInterface, tableName, "total_rows_estimated"))) {
      await queryInterface.addColumn(tableName, "total_rows_estimated", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!(await hasColumn(queryInterface, tableName, "last_heartbeat_at"))) {
      await queryInterface.addColumn(tableName, "last_heartbeat_at", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableName = "billing_ingestion_runs";
    const optionalColumns = [
      "last_heartbeat_at",
      "total_rows_estimated",
      "status_message",
      "progress_percent",
      "current_step",
    ];

    for (const columnName of optionalColumns) {
      if (await hasColumn(queryInterface, tableName, columnName)) {
        await queryInterface.removeColumn(tableName, columnName);
      }
    }
  },
};

export default migration;



