import type { QueryInterface } from "sequelize";

type MigrationDataTypes = typeof import("sequelize").DataTypes;

async function addColumnIfMissing(
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string,
  definition: any,
): Promise<void> {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

async function removeColumnIfPresent(
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string,
): Promise<void> {
  const table = await queryInterface.describeTable(tableName);
  if (table[columnName]) {
    await queryInterface.removeColumn(tableName, columnName);
  }
}

const migration = {
  async up(queryInterface: QueryInterface, Sequelize: MigrationDataTypes): Promise<void> {
    await addColumnIfMissing(queryInterface, "AwsCloudConnections", "roleName", {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
    await addColumnIfMissing(queryInterface, "AwsCloudConnections", "policyName", {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await removeColumnIfPresent(queryInterface, "AwsCloudConnections", "policyName");
    await removeColumnIfPresent(queryInterface, "AwsCloudConnections", "roleName");
  },
};

export default migration;
