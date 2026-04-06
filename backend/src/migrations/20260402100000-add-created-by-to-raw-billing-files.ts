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
    const tableName = "raw_billing_files";
    const columnName = "created_by";

    if (!(await hasColumn(queryInterface, tableName, columnName))) {
      await queryInterface.addColumn(tableName, columnName, {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      });
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_raw_billing_files_created_by
      ON raw_billing_files(created_by);
    `);
  },

  async down(queryInterface) {
    const tableName = "raw_billing_files";
    const columnName = "created_by";

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_raw_billing_files_created_by;
    `);

    if (await hasColumn(queryInterface, tableName, columnName)) {
      await queryInterface.removeColumn(tableName, columnName);
    }
  },
};

export default migration;



