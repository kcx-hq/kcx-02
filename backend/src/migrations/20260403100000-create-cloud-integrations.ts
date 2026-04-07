// @ts-nocheck
const ensureEnumTypes = async (queryInterface) => {
  await queryInterface.sequelize.query(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cloud_integration_mode_enum') THEN
    CREATE TYPE cloud_integration_mode_enum AS ENUM ('manual', 'automatic');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cloud_integration_status_enum') THEN
    CREATE TYPE cloud_integration_status_enum AS ENUM (
      'draft',
      'connecting',
      'awaiting_validation',
      'active',
      'active_with_warnings',
      'failed',
      'suspended'
    );
  END IF;
END
$$;
`);
};

const migration = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    await ensureEnumTypes(queryInterface);

    await queryInterface.createTable("cloud_integrations", {
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
      provider_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: "cloud_providers",
          key: "id",
        },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      connection_mode: {
        type: "cloud_integration_mode_enum",
        allowNull: false,
      },
      display_name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      status: {
        type: "cloud_integration_status_enum",
        allowNull: false,
        defaultValue: "draft",
      },
      detail_record_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      detail_record_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      cloud_account_id: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      payer_account_id: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      last_validated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_success_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_checked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      connected_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addConstraint("cloud_integrations", {
      fields: ["tenant_id", "display_name"],
      type: "unique",
      name: "uq_cloud_integrations_tenant_display_name",
    });

    await queryInterface.addIndex("cloud_integrations", ["tenant_id"], {
      name: "idx_cloud_integrations_tenant_id",
    });

    await queryInterface.addIndex("cloud_integrations", ["provider_id"], {
      name: "idx_cloud_integrations_provider_id",
    });

    await queryInterface.addIndex("cloud_integrations", ["status"], {
      name: "idx_cloud_integrations_status",
    });

    await queryInterface.addIndex("cloud_integrations", ["tenant_id", "provider_id"], {
      name: "idx_cloud_integrations_tenant_provider",
    });

    await queryInterface.addIndex("cloud_integrations", ["detail_record_type", "detail_record_id"], {
      name: "idx_cloud_integrations_detail_record",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("cloud_integrations");
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS cloud_integration_status_enum;");
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS cloud_integration_mode_enum;");
  },
};

export default migration;
