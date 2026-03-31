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
    await addColumnIfMissing(queryInterface, "CloudConnections", "connectionName", {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: "AWS Connection",
    });
    await addColumnIfMissing(queryInterface, "CloudConnections", "setupMode", {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: "manual",
    });
    await addColumnIfMissing(queryInterface, "CloudConnections", "isActive", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, "CloudConnections", "lastValidatedAt", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
    await addColumnIfMissing(queryInterface, "CloudConnections", "lastSyncAt", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
    await addColumnIfMissing(queryInterface, "CloudConnections", "lastSuccessAt", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
    await addColumnIfMissing(queryInterface, "CloudConnections", "lastError", {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });

    await addColumnIfMissing(queryInterface, "AwsCloudConnections", "awsAccountId", {
      type: Sequelize.STRING(12),
      allowNull: true,
      defaultValue: null,
    });
    await addColumnIfMissing(queryInterface, "AwsCloudConnections", "roleArn", {
      type: Sequelize.STRING(512),
      allowNull: true,
      defaultValue: null,
    });
    await addColumnIfMissing(queryInterface, "AwsCloudConnections", "externalId", {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
    await addColumnIfMissing(queryInterface, "AwsCloudConnections", "reportName", {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await removeColumnIfPresent(queryInterface, "AwsCloudConnections", "reportName");
    await removeColumnIfPresent(queryInterface, "AwsCloudConnections", "externalId");
    await removeColumnIfPresent(queryInterface, "AwsCloudConnections", "roleArn");
    await removeColumnIfPresent(queryInterface, "AwsCloudConnections", "awsAccountId");

    await removeColumnIfPresent(queryInterface, "CloudConnections", "lastError");
    await removeColumnIfPresent(queryInterface, "CloudConnections", "lastSuccessAt");
    await removeColumnIfPresent(queryInterface, "CloudConnections", "lastSyncAt");
    await removeColumnIfPresent(queryInterface, "CloudConnections", "lastValidatedAt");
    await removeColumnIfPresent(queryInterface, "CloudConnections", "isActive");
    await removeColumnIfPresent(queryInterface, "CloudConnections", "setupMode");
    await removeColumnIfPresent(queryInterface, "CloudConnections", "connectionName");
  },
};

export default migration;
