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
    const cloudConnectionsTable =
      (await resolveTableName(queryInterface, ["CloudConnections", "cloud_connections"])) ??
      "CloudConnections";
    const awsCloudConnectionsTable =
      (await resolveTableName(queryInterface, ["AwsCloudConnections", "aws_cloud_connections"])) ??
      "AwsCloudConnections";

    await addColumnIfMissing(queryInterface, cloudConnectionsTable, "connectionName", {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: "AWS Connection",
    });
    await addColumnIfMissing(queryInterface, cloudConnectionsTable, "setupMode", {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: "manual",
    });
    await addColumnIfMissing(queryInterface, cloudConnectionsTable, "isActive", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, cloudConnectionsTable, "lastValidatedAt", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
    await addColumnIfMissing(queryInterface, cloudConnectionsTable, "lastSyncAt", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
    await addColumnIfMissing(queryInterface, cloudConnectionsTable, "lastSuccessAt", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
    await addColumnIfMissing(queryInterface, cloudConnectionsTable, "lastError", {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });

    await addColumnIfMissing(queryInterface, awsCloudConnectionsTable, "awsAccountId", {
      type: Sequelize.STRING(12),
      allowNull: true,
      defaultValue: null,
    });
    await addColumnIfMissing(queryInterface, awsCloudConnectionsTable, "roleArn", {
      type: Sequelize.STRING(512),
      allowNull: true,
      defaultValue: null,
    });
    await addColumnIfMissing(queryInterface, awsCloudConnectionsTable, "externalId", {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
    await addColumnIfMissing(queryInterface, awsCloudConnectionsTable, "reportName", {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const cloudConnectionsTable =
      (await resolveTableName(queryInterface, ["CloudConnections", "cloud_connections"])) ??
      "CloudConnections";
    const awsCloudConnectionsTable =
      (await resolveTableName(queryInterface, ["AwsCloudConnections", "aws_cloud_connections"])) ??
      "AwsCloudConnections";

    await removeColumnIfPresent(queryInterface, awsCloudConnectionsTable, "reportName");
    await removeColumnIfPresent(queryInterface, awsCloudConnectionsTable, "externalId");
    await removeColumnIfPresent(queryInterface, awsCloudConnectionsTable, "roleArn");
    await removeColumnIfPresent(queryInterface, awsCloudConnectionsTable, "awsAccountId");

    await removeColumnIfPresent(queryInterface, cloudConnectionsTable, "lastError");
    await removeColumnIfPresent(queryInterface, cloudConnectionsTable, "lastSuccessAt");
    await removeColumnIfPresent(queryInterface, cloudConnectionsTable, "lastSyncAt");
    await removeColumnIfPresent(queryInterface, cloudConnectionsTable, "lastValidatedAt");
    await removeColumnIfPresent(queryInterface, cloudConnectionsTable, "isActive");
    await removeColumnIfPresent(queryInterface, cloudConnectionsTable, "setupMode");
    await removeColumnIfPresent(queryInterface, cloudConnectionsTable, "connectionName");
  },
};

export default migration;
