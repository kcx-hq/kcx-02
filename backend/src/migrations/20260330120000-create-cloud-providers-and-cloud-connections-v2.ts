/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const hasTable = async (queryInterface, tableName) => {
    try {
        await queryInterface.describeTable(tableName);
        return true;
    }
    catch {
        return false;
    }
};
const hasColumn = async (queryInterface, tableName, columnName) => {
    try {
        const columns = await queryInterface.describeTable(tableName);
        return Boolean(columns[columnName]);
    }
    catch {
        return false;
    }
};
const ensureEnumTypes = async (queryInterface) => {
    await queryInterface.sequelize.query(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cloud_account_type_enum') THEN
    CREATE TYPE cloud_account_type_enum AS ENUM ('payer', 'member');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cloud_connection_status_enum') THEN
    CREATE TYPE cloud_connection_status_enum AS ENUM (
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
const createCloudConnectionsTableSql = (tableName) => `
CREATE TABLE ${tableName} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES cloud_providers(id),

  connection_name VARCHAR(150) NOT NULL,

  account_type cloud_account_type_enum NOT NULL DEFAULT 'payer',
  status cloud_connection_status_enum NOT NULL DEFAULT 'draft',

  region VARCHAR(50) DEFAULT 'us-east-1',

  external_id VARCHAR(255),
  callback_token VARCHAR(255),
  stack_name VARCHAR(255),
  stack_id TEXT,

  cloud_account_id VARCHAR(50),
  payer_account_id VARCHAR(50),
  billing_role_arn TEXT,
  action_role_arn TEXT,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  connected_at TIMESTAMP WITH TIME ZONE,
  last_validated_at TIMESTAMP WITH TIME ZONE,

  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT uq_tenant_connection_name UNIQUE (tenant_id, connection_name)
);
`;
const migration = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
        if (!(await hasTable(queryInterface, "cloud_providers"))) {
            await queryInterface.createTable("cloud_providers", {
                id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    primaryKey: true,
                    defaultValue: Sequelize.literal("gen_random_uuid()"),
                },
                code: { type: Sequelize.STRING(30), allowNull: false, unique: true },
                name: { type: Sequelize.STRING(100), allowNull: false },
                status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "active" },
                created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
                updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
            });
        }
        await ensureEnumTypes(queryInterface);
        const cloudConnectionsExists = await hasTable(queryInterface, "cloud_connections");
        if (!cloudConnectionsExists) {
            await queryInterface.sequelize.query(createCloudConnectionsTableSql("cloud_connections"));
            return;
        }
        if (await hasColumn(queryInterface, "cloud_connections", "tenant_id")) {
            return;
        }
        await queryInterface.sequelize.query(`DROP TABLE IF EXISTS cloud_connections__v2;`);
        await queryInterface.sequelize.query(createCloudConnectionsTableSql("cloud_connections__v2"));
        const canMigrateFromLegacySchema = (await hasColumn(queryInterface, "cloud_connections", "user_id")) &&
            (await hasColumn(queryInterface, "cloud_connections", "provider")) &&
            (await hasTable(queryInterface, "users"));
        if (canMigrateFromLegacySchema) {
            await queryInterface.sequelize.query(`
INSERT INTO cloud_providers (code, name, status)
SELECT DISTINCT
  LEFT(cc.provider, 30) AS code,
  LEFT(cc.provider, 100) AS name,
  'active' AS status
FROM cloud_connections cc
WHERE cc.provider IS NOT NULL AND cc.provider <> ''
ON CONFLICT (code) DO NOTHING;
`);
            await queryInterface.sequelize.query(`
INSERT INTO cloud_connections__v2 (
  id,
  tenant_id,
  provider_id,
  connection_name,
  account_type,
  status,
  region,
  external_id,
  callback_token,
  stack_name,
  stack_id,
  cloud_account_id,
  payer_account_id,
  billing_role_arn,
  action_role_arn,
  created_by,
  connected_at,
  last_validated_at,
  error_message,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid() AS id,
  u.tenant_id AS tenant_id,
  cp.id AS provider_id,
  cc.connection_name AS connection_name,
  (
    CASE
      WHEN cc.account_type IN ('linked', 'member') THEN 'member'
      ELSE 'payer'
    END
  )::cloud_account_type_enum AS account_type,
  (
    CASE
      WHEN cc.status = 'active' THEN 'active'
      WHEN cc.status = 'disabled' THEN 'suspended'
      WHEN cc.status IN ('error', 'failed') THEN 'failed'
      ELSE 'draft'
    END
  )::cloud_connection_status_enum AS status,
  'us-east-1' AS region,
  NULL AS external_id,
  NULL AS callback_token,
  NULL AS stack_name,
  NULL AS stack_id,
  NULL AS cloud_account_id,
  NULL AS payer_account_id,
  NULL AS billing_role_arn,
  NULL AS action_role_arn,
  cc.user_id AS created_by,
  NULL AS connected_at,
  NULL AS last_validated_at,
  NULL AS error_message,
  cc.created_at AS created_at,
  cc.updated_at AS updated_at
FROM cloud_connections cc
JOIN users u ON u.id = cc.user_id
JOIN cloud_providers cp ON cp.code = LEFT(cc.provider, 30);
`);
        }
        await queryInterface.renameTable("cloud_connections", "cloud_connections__old");
        await queryInterface.renameTable("cloud_connections__v2", "cloud_connections");
        // Keep legacy table when dependent objects (for example AwsCloudConnections FK) still reference it.
        try {
            await queryInterface.sequelize.query(`DROP TABLE IF EXISTS cloud_connections__old;`);
        }
        catch {
            // Intentional no-op: downstream migrations can continue while legacy references are cleaned up later.
        }
    },
    async down(queryInterface) {
        await queryInterface.sequelize.query(`DROP TABLE IF EXISTS cloud_connections;`);
        await queryInterface.sequelize.query(`DROP TABLE IF EXISTS cloud_providers;`);
        await queryInterface.sequelize.query(`DROP TYPE IF EXISTS cloud_connection_status_enum;`);
        await queryInterface.sequelize.query(`DROP TYPE IF EXISTS cloud_account_type_enum;`);
    },
};
export default migration;




