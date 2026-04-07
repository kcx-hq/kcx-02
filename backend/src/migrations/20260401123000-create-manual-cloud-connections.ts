/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    await queryInterface.createTable("manual_cloud_connections", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "tenants",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      connection_name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      aws_account_id: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      role_arn: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      external_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      bucket_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      prefix: {
        type: Sequelize.STRING(1000),
        allowNull: true,
      },
      report_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      last_validated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      validation_status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "pending",
      },
      assume_role_success: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "draft",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    await queryInterface.addIndex("manual_cloud_connections", ["tenant_id"], {
      name: "idx_manual_cloud_connections_tenant_id",
    });

    await queryInterface.addIndex("manual_cloud_connections", ["tenant_id", "connection_name"], {
      name: "idx_manual_cloud_connections_tenant_connection_name",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("manual_cloud_connections");
  },
};

export default migration;



