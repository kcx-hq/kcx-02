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
        const table = await queryInterface.describeTable(tableName);
        return Boolean(table[columnName]);
    }
    catch {
        return false;
    }
};
const getColumnType = async (queryInterface, tableName, columnName) => {
    try {
        const table = await queryInterface.describeTable(tableName);
        return String(table[columnName]?.type ?? "").toUpperCase();
    }
    catch {
        return null;
    }
};
const isBigint = (type) => Boolean(type && type.includes("BIGINT"));
const isUuid = (type) => Boolean(type && type.includes("UUID"));
const dropCloudProviderForeignKeyConstraints = async (queryInterface, tableName, columnName) => {
    await queryInterface.sequelize.query(`
DO $$
DECLARE con RECORD;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a
      ON a.attrelid = t.oid
     AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND c.confrelid = 'cloud_providers'::regclass
      AND t.relname = '${tableName}'
      AND a.attname = '${columnName}'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '${tableName}', con.conname);
  END LOOP;
END
$$;
`);
};
const addCloudProviderForeignKeys = async (queryInterface) => {
    await queryInterface.sequelize.query(`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cloud_connections' AND column_name = 'provider_id') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cloud_connections_provider_id') THEN
      ALTER TABLE cloud_connections
      ADD CONSTRAINT fk_cloud_connections_provider_id
      FOREIGN KEY (provider_id)
      REFERENCES cloud_providers(id)
      ON DELETE RESTRICT;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing_sources' AND column_name = 'cloud_provider_id') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_billing_sources_cloud_provider_id') THEN
      ALTER TABLE billing_sources
      ADD CONSTRAINT fk_billing_sources_cloud_provider_id
      FOREIGN KEY (cloud_provider_id)
      REFERENCES cloud_providers(id)
      ON DELETE RESTRICT;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_billing_files' AND column_name = 'cloud_provider_id') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_raw_billing_files_cloud_provider_id') THEN
      ALTER TABLE raw_billing_files
      ADD CONSTRAINT fk_raw_billing_files_cloud_provider_id
      FOREIGN KEY (cloud_provider_id)
      REFERENCES cloud_providers(id)
      ON DELETE RESTRICT;
    END IF;
  END IF;
END
$$;
`);
};
const ensureCloudProviderIndexes = async (queryInterface) => {
    await queryInterface.sequelize.query(`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing_sources' AND column_name = 'cloud_provider_id') THEN
    CREATE INDEX IF NOT EXISTS idx_billing_sources_provider_id ON billing_sources(cloud_provider_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_billing_files' AND column_name = 'cloud_provider_id') THEN
    CREATE INDEX IF NOT EXISTS idx_raw_billing_files_cloud_provider_id ON raw_billing_files(cloud_provider_id);
  END IF;
END
$$;
`);
};
const migration = {
    async up(queryInterface) {
        if (!(await hasTable(queryInterface, "cloud_providers"))) {
            return;
        }
        const cloudProviderIdType = await getColumnType(queryInterface, "cloud_providers", "id");
        if (isBigint(cloudProviderIdType)) {
            return;
        }
        await queryInterface.sequelize.query(`
CREATE SEQUENCE IF NOT EXISTS cloud_providers_id_seq;

ALTER TABLE cloud_providers
  ADD COLUMN IF NOT EXISTS id_bigint BIGINT;

ALTER TABLE cloud_providers
  ALTER COLUMN id_bigint SET DEFAULT nextval('cloud_providers_id_seq');

UPDATE cloud_providers
SET id_bigint = nextval('cloud_providers_id_seq')
WHERE id_bigint IS NULL;

ALTER TABLE cloud_providers
  ALTER COLUMN id_bigint SET NOT NULL;
`);
        if ((await hasTable(queryInterface, "cloud_connections")) && (await hasColumn(queryInterface, "cloud_connections", "provider_id"))) {
            const providerIdType = await getColumnType(queryInterface, "cloud_connections", "provider_id");
            if (!isBigint(providerIdType)) {
                await queryInterface.sequelize.query(`
ALTER TABLE cloud_connections
  ADD COLUMN IF NOT EXISTS provider_id_bigint BIGINT;

UPDATE cloud_connections cc
SET provider_id_bigint = cp.id_bigint
FROM cloud_providers cp
WHERE cc.provider_id = cp.id;

ALTER TABLE cloud_connections
  ALTER COLUMN provider_id_bigint SET NOT NULL;
`);
            }
        }
        if ((await hasTable(queryInterface, "billing_sources")) && (await hasColumn(queryInterface, "billing_sources", "cloud_provider_id"))) {
            const billingSourceProviderIdType = await getColumnType(queryInterface, "billing_sources", "cloud_provider_id");
            if (!isBigint(billingSourceProviderIdType)) {
                await queryInterface.sequelize.query(`
ALTER TABLE billing_sources
  ADD COLUMN IF NOT EXISTS cloud_provider_id_bigint BIGINT;

UPDATE billing_sources bs
SET cloud_provider_id_bigint = cp.id_bigint
FROM cloud_providers cp
WHERE bs.cloud_provider_id = cp.id;

ALTER TABLE billing_sources
  ALTER COLUMN cloud_provider_id_bigint SET NOT NULL;
`);
            }
        }
        if ((await hasTable(queryInterface, "raw_billing_files")) && (await hasColumn(queryInterface, "raw_billing_files", "cloud_provider_id"))) {
            const rawBillingProviderIdType = await getColumnType(queryInterface, "raw_billing_files", "cloud_provider_id");
            if (!isBigint(rawBillingProviderIdType)) {
                await queryInterface.sequelize.query(`
ALTER TABLE raw_billing_files
  ADD COLUMN IF NOT EXISTS cloud_provider_id_bigint BIGINT;

UPDATE raw_billing_files rbf
SET cloud_provider_id_bigint = cp.id_bigint
FROM cloud_providers cp
WHERE rbf.cloud_provider_id = cp.id;

ALTER TABLE raw_billing_files
  ALTER COLUMN cloud_provider_id_bigint SET NOT NULL;
`);
            }
        }
        if ((await hasTable(queryInterface, "cloud_connections")) && (await hasColumn(queryInterface, "cloud_connections", "provider_id"))) {
            await dropCloudProviderForeignKeyConstraints(queryInterface, "cloud_connections", "provider_id");
        }
        if ((await hasTable(queryInterface, "billing_sources")) && (await hasColumn(queryInterface, "billing_sources", "cloud_provider_id"))) {
            await dropCloudProviderForeignKeyConstraints(queryInterface, "billing_sources", "cloud_provider_id");
        }
        if ((await hasTable(queryInterface, "raw_billing_files")) && (await hasColumn(queryInterface, "raw_billing_files", "cloud_provider_id"))) {
            await dropCloudProviderForeignKeyConstraints(queryInterface, "raw_billing_files", "cloud_provider_id");
        }
        if ((await hasTable(queryInterface, "cloud_connections")) && (await hasColumn(queryInterface, "cloud_connections", "provider_id_bigint"))) {
            await queryInterface.sequelize.query(`
ALTER TABLE cloud_connections
  DROP COLUMN provider_id;

ALTER TABLE cloud_connections
  RENAME COLUMN provider_id_bigint TO provider_id;
`);
        }
        if ((await hasTable(queryInterface, "billing_sources")) && (await hasColumn(queryInterface, "billing_sources", "cloud_provider_id_bigint"))) {
            await queryInterface.sequelize.query(`
ALTER TABLE billing_sources
  DROP COLUMN cloud_provider_id;

ALTER TABLE billing_sources
  RENAME COLUMN cloud_provider_id_bigint TO cloud_provider_id;
`);
        }
        if ((await hasTable(queryInterface, "raw_billing_files")) && (await hasColumn(queryInterface, "raw_billing_files", "cloud_provider_id_bigint"))) {
            await queryInterface.sequelize.query(`
ALTER TABLE raw_billing_files
  DROP COLUMN cloud_provider_id;

ALTER TABLE raw_billing_files
  RENAME COLUMN cloud_provider_id_bigint TO cloud_provider_id;
`);
        }
        await queryInterface.sequelize.query(`
ALTER TABLE cloud_providers
  DROP CONSTRAINT IF EXISTS cloud_providers_pkey;

ALTER TABLE cloud_providers
  DROP COLUMN id;

ALTER TABLE cloud_providers
  RENAME COLUMN id_bigint TO id;

ALTER TABLE cloud_providers
  ALTER COLUMN id SET DEFAULT nextval('cloud_providers_id_seq');

ALTER SEQUENCE cloud_providers_id_seq OWNED BY cloud_providers.id;

SELECT setval('cloud_providers_id_seq', COALESCE((SELECT MAX(id) FROM cloud_providers), 0) + 1, false);

ALTER TABLE cloud_providers
  ADD CONSTRAINT cloud_providers_pkey PRIMARY KEY (id);
`);
        await addCloudProviderForeignKeys(queryInterface);
        await ensureCloudProviderIndexes(queryInterface);
    },
    async down(queryInterface) {
        if (!(await hasTable(queryInterface, "cloud_providers"))) {
            return;
        }
        const cloudProviderIdType = await getColumnType(queryInterface, "cloud_providers", "id");
        if (isUuid(cloudProviderIdType)) {
            return;
        }
        await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE cloud_providers
  ADD COLUMN IF NOT EXISTS id_uuid UUID DEFAULT gen_random_uuid();

UPDATE cloud_providers
SET id_uuid = gen_random_uuid()
WHERE id_uuid IS NULL;

ALTER TABLE cloud_providers
  ALTER COLUMN id_uuid SET NOT NULL;
`);
        if ((await hasTable(queryInterface, "cloud_connections")) && (await hasColumn(queryInterface, "cloud_connections", "provider_id"))) {
            const providerIdType = await getColumnType(queryInterface, "cloud_connections", "provider_id");
            if (!isUuid(providerIdType)) {
                await queryInterface.sequelize.query(`
ALTER TABLE cloud_connections
  ADD COLUMN IF NOT EXISTS provider_id_uuid UUID;

UPDATE cloud_connections cc
SET provider_id_uuid = cp.id_uuid
FROM cloud_providers cp
WHERE cc.provider_id = cp.id;

ALTER TABLE cloud_connections
  ALTER COLUMN provider_id_uuid SET NOT NULL;
`);
            }
        }
        if ((await hasTable(queryInterface, "billing_sources")) && (await hasColumn(queryInterface, "billing_sources", "cloud_provider_id"))) {
            const billingSourceProviderIdType = await getColumnType(queryInterface, "billing_sources", "cloud_provider_id");
            if (!isUuid(billingSourceProviderIdType)) {
                await queryInterface.sequelize.query(`
ALTER TABLE billing_sources
  ADD COLUMN IF NOT EXISTS cloud_provider_id_uuid UUID;

UPDATE billing_sources bs
SET cloud_provider_id_uuid = cp.id_uuid
FROM cloud_providers cp
WHERE bs.cloud_provider_id = cp.id;

ALTER TABLE billing_sources
  ALTER COLUMN cloud_provider_id_uuid SET NOT NULL;
`);
            }
        }
        if ((await hasTable(queryInterface, "raw_billing_files")) && (await hasColumn(queryInterface, "raw_billing_files", "cloud_provider_id"))) {
            const rawBillingProviderIdType = await getColumnType(queryInterface, "raw_billing_files", "cloud_provider_id");
            if (!isUuid(rawBillingProviderIdType)) {
                await queryInterface.sequelize.query(`
ALTER TABLE raw_billing_files
  ADD COLUMN IF NOT EXISTS cloud_provider_id_uuid UUID;

UPDATE raw_billing_files rbf
SET cloud_provider_id_uuid = cp.id_uuid
FROM cloud_providers cp
WHERE rbf.cloud_provider_id = cp.id;

ALTER TABLE raw_billing_files
  ALTER COLUMN cloud_provider_id_uuid SET NOT NULL;
`);
            }
        }
        if ((await hasTable(queryInterface, "cloud_connections")) && (await hasColumn(queryInterface, "cloud_connections", "provider_id"))) {
            await dropCloudProviderForeignKeyConstraints(queryInterface, "cloud_connections", "provider_id");
        }
        if ((await hasTable(queryInterface, "billing_sources")) && (await hasColumn(queryInterface, "billing_sources", "cloud_provider_id"))) {
            await dropCloudProviderForeignKeyConstraints(queryInterface, "billing_sources", "cloud_provider_id");
        }
        if ((await hasTable(queryInterface, "raw_billing_files")) && (await hasColumn(queryInterface, "raw_billing_files", "cloud_provider_id"))) {
            await dropCloudProviderForeignKeyConstraints(queryInterface, "raw_billing_files", "cloud_provider_id");
        }
        if ((await hasTable(queryInterface, "cloud_connections")) && (await hasColumn(queryInterface, "cloud_connections", "provider_id_uuid"))) {
            await queryInterface.sequelize.query(`
ALTER TABLE cloud_connections
  DROP COLUMN provider_id;

ALTER TABLE cloud_connections
  RENAME COLUMN provider_id_uuid TO provider_id;
`);
        }
        if ((await hasTable(queryInterface, "billing_sources")) && (await hasColumn(queryInterface, "billing_sources", "cloud_provider_id_uuid"))) {
            await queryInterface.sequelize.query(`
ALTER TABLE billing_sources
  DROP COLUMN cloud_provider_id;

ALTER TABLE billing_sources
  RENAME COLUMN cloud_provider_id_uuid TO cloud_provider_id;
`);
        }
        if ((await hasTable(queryInterface, "raw_billing_files")) && (await hasColumn(queryInterface, "raw_billing_files", "cloud_provider_id_uuid"))) {
            await queryInterface.sequelize.query(`
ALTER TABLE raw_billing_files
  DROP COLUMN cloud_provider_id;

ALTER TABLE raw_billing_files
  RENAME COLUMN cloud_provider_id_uuid TO cloud_provider_id;
`);
        }
        await queryInterface.sequelize.query(`
ALTER TABLE cloud_providers
  DROP CONSTRAINT IF EXISTS cloud_providers_pkey;

ALTER TABLE cloud_providers
  DROP COLUMN id;

ALTER TABLE cloud_providers
  RENAME COLUMN id_uuid TO id;

ALTER TABLE cloud_providers
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE cloud_providers
  ADD CONSTRAINT cloud_providers_pkey PRIMARY KEY (id);
`);
        await addCloudProviderForeignKeys(queryInterface);
        await ensureCloudProviderIndexes(queryInterface);
    },
};
export default migration;




