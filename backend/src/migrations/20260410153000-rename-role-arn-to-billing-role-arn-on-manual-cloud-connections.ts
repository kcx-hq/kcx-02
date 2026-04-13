/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const TABLE_NAME = "manual_cloud_connections";

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
    if (!(await hasTable(queryInterface, TABLE_NAME))) return;

    const hasRoleArn = await hasColumn(queryInterface, TABLE_NAME, "role_arn");
    const hasBillingRoleArn = await hasColumn(queryInterface, TABLE_NAME, "billing_role_arn");

    if (hasRoleArn && !hasBillingRoleArn) {
      await queryInterface.renameColumn(TABLE_NAME, "role_arn", "billing_role_arn");
    } else if (hasRoleArn && hasBillingRoleArn) {
      await queryInterface.sequelize.query(`
        UPDATE ${TABLE_NAME}
        SET billing_role_arn = COALESCE(billing_role_arn, role_arn)
        WHERE billing_role_arn IS NULL;
      `);
      await queryInterface.removeColumn(TABLE_NAME, "role_arn");
    } else if (!hasRoleArn && !hasBillingRoleArn) {
      await queryInterface.addColumn(TABLE_NAME, "billing_role_arn", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE ${TABLE_NAME}
      ALTER COLUMN billing_role_arn SET NOT NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    if (!(await hasTable(queryInterface, TABLE_NAME))) return;

    const hasRoleArn = await hasColumn(queryInterface, TABLE_NAME, "role_arn");
    const hasBillingRoleArn = await hasColumn(queryInterface, TABLE_NAME, "billing_role_arn");
    if (hasRoleArn) return;
    if (!hasBillingRoleArn) return;

    await queryInterface.addColumn(TABLE_NAME, "role_arn", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE ${TABLE_NAME}
      SET role_arn = billing_role_arn
      WHERE role_arn IS NULL;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE ${TABLE_NAME}
      ALTER COLUMN role_arn SET NOT NULL;
    `);
  },
};

export default migration;

