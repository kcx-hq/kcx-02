import type { QueryInterface } from "sequelize";

type MigrationDataTypes = typeof import("sequelize").DataTypes;

const migration = {
  async up(queryInterface: QueryInterface, Sequelize: MigrationDataTypes): Promise<void> {
    await queryInterface.createTable("CloudConnections", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      clientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
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

    await queryInterface.addIndex("CloudConnections", ["clientId"]);
    await queryInterface.addIndex("CloudConnections", ["provider"]);
    await queryInterface.addIndex("CloudConnections", ["status"]);

    // Enforce one DRAFT per client+provider.
    await queryInterface.addIndex("CloudConnections", ["clientId", "provider"], {
      unique: true,
      where: {
        status: "DRAFT",
      },
      name: "cloud_connections_client_provider_draft_unique",
    });

    await queryInterface.createTable("AwsCloudConnections", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      cloudConnectionId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: "CloudConnections", key: "id" },
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

    await queryInterface.addIndex("AwsCloudConnections", ["cloudConnectionId"], {
      unique: true,
      name: "aws_cloud_connections_cloud_connection_id_unique",
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeIndex("AwsCloudConnections", "aws_cloud_connections_cloud_connection_id_unique");
    await queryInterface.dropTable("AwsCloudConnections");

    await queryInterface.removeIndex("CloudConnections", "cloud_connections_client_provider_draft_unique");
    await queryInterface.dropTable("CloudConnections");
  },
};

export default migration;
