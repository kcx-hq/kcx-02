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
  async up(queryInterface) {
    const tableName = "raw_billing_files";

    const hasCreatedBy = await hasColumn(queryInterface, tableName, "created_by");
    let hasUploadedBy = await hasColumn(queryInterface, tableName, "uploaded_by");

    if (hasCreatedBy && !hasUploadedBy) {
      await queryInterface.renameColumn(tableName, "created_by", "uploaded_by");
      hasUploadedBy = true;
    }

    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_raw_billing_files_created_by;`);
    if (hasUploadedBy) {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_raw_billing_files_uploaded_by
        ON raw_billing_files(uploaded_by);
      `);
    }
  },

  async down(queryInterface) {
    const tableName = "raw_billing_files";

    let hasCreatedBy = await hasColumn(queryInterface, tableName, "created_by");
    const hasUploadedBy = await hasColumn(queryInterface, tableName, "uploaded_by");

    if (!hasCreatedBy && hasUploadedBy) {
      await queryInterface.renameColumn(tableName, "uploaded_by", "created_by");
      hasCreatedBy = true;
    }

    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_raw_billing_files_uploaded_by;`);
    if (hasCreatedBy) {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_raw_billing_files_created_by
        ON raw_billing_files(created_by);
      `);
    }
  },
};

export default migration;
