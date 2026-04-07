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
    const tableName = "billing_sources";

    if (!(await hasTable(queryInterface, tableName))) return;

    if (!(await hasColumn(queryInterface, tableName, "is_temporary"))) {
      await queryInterface.addColumn(tableName, "is_temporary", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_billing_sources_tenant_source_mode
      ON billing_sources(tenant_id, source_type, setup_mode);
    `);
  },

  async down(queryInterface) {
    const tableName = "billing_sources";

    if (!(await hasTable(queryInterface, tableName))) return;

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_billing_sources_tenant_source_mode;
    `);

    if (await hasColumn(queryInterface, tableName, "is_temporary")) {
      await queryInterface.removeColumn(tableName, "is_temporary");
    }
  },
};

export default migration;
