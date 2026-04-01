import type { QueryInterface } from "sequelize";

type MigrationDataTypes = typeof import("sequelize").DataTypes;

const resolveTableName = async (
  queryInterface: QueryInterface,
  candidates: string[],
): Promise<string | null> => {
  for (const tableName of candidates) {
    try {
      await queryInterface.describeTable(tableName);
      return tableName;
    } catch {
      continue;
    }
  }
  return null;
};

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
    const awsCloudConnectionsTable =
      (await resolveTableName(queryInterface, ["AwsCloudConnections", "aws_cloud_connections"])) ??
      "AwsCloudConnections";

    await addColumnIfMissing(queryInterface, awsCloudConnectionsTable, "roleName", {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
    await addColumnIfMissing(queryInterface, awsCloudConnectionsTable, "policyName", {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const awsCloudConnectionsTable =
      (await resolveTableName(queryInterface, ["AwsCloudConnections", "aws_cloud_connections"])) ??
      "AwsCloudConnections";

    await removeColumnIfPresent(queryInterface, awsCloudConnectionsTable, "policyName");
    await removeColumnIfPresent(queryInterface, awsCloudConnectionsTable, "roleName");
  },
};

export default migration;
