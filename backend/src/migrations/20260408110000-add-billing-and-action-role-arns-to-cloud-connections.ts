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
    const columns = await queryInterface.describeTable(tableName);
    return Boolean(columns[columnName]);
  } catch {
    return false;
  }
};

const migration = {
  async up(queryInterface, Sequelize) {
    const tableName = "cloud_connections";
    if (!(await hasTable(queryInterface, tableName))) return;

    const hasLegacyRoleArn = await hasColumn(queryInterface, tableName, "role_arn");
    const hasBillingRoleArn = await hasColumn(queryInterface, tableName, "billing_role_arn");
    if (hasLegacyRoleArn && !hasBillingRoleArn) {
      await queryInterface.renameColumn(tableName, "role_arn", "billing_role_arn");
    }

    if (!(await hasColumn(queryInterface, tableName, "action_role_arn"))) {
      await queryInterface.addColumn(tableName, "action_role_arn", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableName = "cloud_connections";
    if (!(await hasTable(queryInterface, tableName))) return;

    if (await hasColumn(queryInterface, tableName, "action_role_arn")) {
      await queryInterface.removeColumn(tableName, "action_role_arn");
    }

    const hasLegacyRoleArn = await hasColumn(queryInterface, tableName, "role_arn");
    const hasBillingRoleArn = await hasColumn(queryInterface, tableName, "billing_role_arn");
    if (!hasLegacyRoleArn && hasBillingRoleArn) {
      await queryInterface.renameColumn(tableName, "billing_role_arn", "role_arn");
    }
  },
};

export default migration;

