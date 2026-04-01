import type { QueryInterface } from "sequelize";

type MigrationDataTypes = typeof import("sequelize").DataTypes;

const hasTable = async (queryInterface: QueryInterface, tableName: string): Promise<boolean> => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const migration = {
  async up(queryInterface: QueryInterface, Sequelize: MigrationDataTypes): Promise<void> {
    const parentTableName = (await hasTable(queryInterface, "cloud_connections"))
      ? "cloud_connections"
      : "CloudConnections";
    const userTableName = (await hasTable(queryInterface, "users")) ? "users" : "Users";
    const parentExists = await hasTable(queryInterface, parentTableName);
    const awsExists = await hasTable(queryInterface, "AwsCloudConnections");

    if (!parentExists) {
      await queryInterface.createTable(parentTableName, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
        },
        clientId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: userTableName, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        provider: {
          type: Sequelize.STRING(50),
          allowNull: false,
        },
        status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: "DRAFT",
        },
        currentStep: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
      });
    }

    const parentSchema = await queryInterface.describeTable(parentTableName);
    const fkColumnType = parentSchema.id?.type?.toLowerCase().includes("integer")
      ? Sequelize.INTEGER
      : Sequelize.UUID;

    if (!awsExists) {
      await queryInterface.createTable("AwsCloudConnections", {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
        },
        cloudConnectionId: {
          type: fkColumnType,
          allowNull: false,
          unique: true,
          references: { model: parentTableName, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        bucketName: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        bucketPrefix: {
          type: Sequelize.STRING(1024),
          allowNull: true,
        },
        setupMethod: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: "manual",
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
      });
    }

    await queryInterface.addIndex(parentTableName, ["clientId"]).catch(() => undefined);
    await queryInterface.addIndex(parentTableName, ["provider"]).catch(() => undefined);
    await queryInterface.addIndex(parentTableName, ["status"]).catch(() => undefined);

    await queryInterface
      .addIndex(parentTableName, ["clientId", "provider"], {
        unique: true,
        where: {
          status: "DRAFT",
        },
        name: "cloud_connections_client_provider_draft_unique",
      })
      .catch(() => undefined);

    await queryInterface
      .addIndex("AwsCloudConnections", ["cloudConnectionId"], {
        unique: true,
        name: "aws_cloud_connections_cloud_connection_id_unique",
      })
      .catch(() => undefined);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface
      .removeIndex("AwsCloudConnections", "aws_cloud_connections_cloud_connection_id_unique")
      .catch(() => undefined);
    await queryInterface.dropTable("AwsCloudConnections").catch(() => undefined);

    if (await hasTable(queryInterface, "CloudConnections")) {
      await queryInterface.removeIndex("CloudConnections", "cloud_connections_client_provider_draft_unique").catch(() => undefined);
      await queryInterface.dropTable("CloudConnections").catch(() => undefined);
    }
  },
};

export default migration;
