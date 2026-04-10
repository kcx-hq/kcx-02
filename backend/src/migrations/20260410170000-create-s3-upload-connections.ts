/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const TABLE_NAME = "s3_upload_connections";

const migration = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE_NAME, {
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
      role_arn: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      external_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      bucket_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      base_prefix: {
        type: Sequelize.STRING(1000),
        allowNull: true,
      },
      aws_account_id: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      assumed_arn: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      resolved_region: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      last_validated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "active",
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

    await queryInterface.addIndex(TABLE_NAME, ["tenant_id"], {
      name: "idx_s3_upload_connections_tenant_id",
    });
    await queryInterface.addIndex(TABLE_NAME, ["status"], {
      name: "idx_s3_upload_connections_status",
    });
    await queryInterface.addIndex(
      TABLE_NAME,
      ["tenant_id", "bucket_name", "base_prefix", "role_arn", "external_id"],
      {
        name: "uq_s3_upload_connections_identity",
        unique: true,
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE_NAME);
  },
};

export default migration;
