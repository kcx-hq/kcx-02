/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const TABLE_NAME = "manual_cloud_connections";
const TENANT_CONNECTION_UNIQUE_INDEX = "uq_manual_cloud_connections_tenant_connection_name";
const TENANT_CONNECTION_INDEX = "idx_manual_cloud_connections_tenant_connection_name";
const STATUS_INDEX = "idx_manual_cloud_connections_status";
const IS_COMPLETE_INDEX = "idx_manual_cloud_connections_is_complete";
const CLOUDTRAIL_ENABLED_INDEX = "idx_manual_cloud_connections_cloudtrail_enabled";

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

const addColumnIfMissing = async (queryInterface, Sequelize, columnName, definition) => {
  if (await hasColumn(queryInterface, TABLE_NAME, columnName)) return;
  await queryInterface.addColumn(TABLE_NAME, columnName, definition);
};

const migration = {
  async up(queryInterface, Sequelize) {
    if (!(await hasTable(queryInterface, TABLE_NAME))) return;

    await addColumnIfMissing(queryInterface, Sequelize, "aws_region", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "kcx_principal_arn", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "file_event_callback_url", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "callback_token", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, Sequelize, "billing_role_name", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "billing_role_arn", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "export_bucket_name", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "export_prefix", {
      type: Sequelize.STRING(1000),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "export_name", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "export_arn", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, Sequelize, "action_role_enabled", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "action_role_name", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "action_role_arn", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "ec2_module_enabled", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "use_tag_scoped_access", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await addColumnIfMissing(queryInterface, Sequelize, "billing_file_event_lambda_arn", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "billing_eventbridge_rule_name", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "billing_file_event_status", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "billing_file_event_validated_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, Sequelize, "cloudtrail_enabled", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "cloudtrail_bucket_name", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "cloudtrail_prefix", {
      type: Sequelize.STRING(1000),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "cloudtrail_trail_name", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "cloudtrail_lambda_arn", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "cloudtrail_eventbridge_rule_name", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "cloudtrail_status", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "cloudtrail_validated_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, Sequelize, "setup_step", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "is_complete", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "completed_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "completed_by", {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    await addColumnIfMissing(queryInterface, Sequelize, "setup_payload_json", {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE ${TABLE_NAME}
      SET
        billing_role_arn = COALESCE(billing_role_arn, role_arn),
        export_bucket_name = COALESCE(export_bucket_name, bucket_name),
        export_prefix = COALESCE(export_prefix, prefix),
        export_name = COALESCE(export_name, report_name),
        billing_role_name = COALESCE(
          billing_role_name,
          NULLIF(regexp_replace(COALESCE(role_arn, ''), '^.*role/', ''), '')
        )
      WHERE
        billing_role_arn IS NULL
        OR export_bucket_name IS NULL
        OR export_prefix IS NULL
        OR export_name IS NULL
        OR billing_role_name IS NULL;
    `);

    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY tenant_id, connection_name
            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
          ) AS row_number
        FROM ${TABLE_NAME}
      )
      DELETE FROM ${TABLE_NAME} t
      USING ranked r
      WHERE t.id = r.id
        AND r.row_number > 1;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS ${TENANT_CONNECTION_INDEX};
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${TENANT_CONNECTION_UNIQUE_INDEX}
      ON ${TABLE_NAME} (tenant_id, connection_name);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ${STATUS_INDEX}
      ON ${TABLE_NAME} (status);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ${IS_COMPLETE_INDEX}
      ON ${TABLE_NAME} (is_complete);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ${CLOUDTRAIL_ENABLED_INDEX}
      ON ${TABLE_NAME} (cloudtrail_enabled);
    `);
  },

  async down(queryInterface) {
    if (!(await hasTable(queryInterface, TABLE_NAME))) return;

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS ${CLOUDTRAIL_ENABLED_INDEX};
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS ${IS_COMPLETE_INDEX};
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS ${STATUS_INDEX};
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS ${TENANT_CONNECTION_UNIQUE_INDEX};
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ${TENANT_CONNECTION_INDEX}
      ON ${TABLE_NAME} (tenant_id, connection_name);
    `);

    const columnsToDrop = [
      "setup_payload_json",
      "completed_by",
      "completed_at",
      "is_complete",
      "setup_step",
      "cloudtrail_validated_at",
      "cloudtrail_status",
      "cloudtrail_eventbridge_rule_name",
      "cloudtrail_lambda_arn",
      "cloudtrail_trail_name",
      "cloudtrail_prefix",
      "cloudtrail_bucket_name",
      "cloudtrail_enabled",
      "billing_file_event_validated_at",
      "billing_file_event_status",
      "billing_eventbridge_rule_name",
      "billing_file_event_lambda_arn",
      "use_tag_scoped_access",
      "ec2_module_enabled",
      "action_role_arn",
      "action_role_name",
      "action_role_enabled",
      "export_arn",
      "export_name",
      "export_prefix",
      "export_bucket_name",
      "billing_role_arn",
      "billing_role_name",
      "callback_token",
      "file_event_callback_url",
      "kcx_principal_arn",
      "aws_region",
    ];

    for (const column of columnsToDrop) {
      if (await hasColumn(queryInterface, TABLE_NAME, column)) {
        await queryInterface.removeColumn(TABLE_NAME, column);
      }
    }
  },
};

export default migration;

