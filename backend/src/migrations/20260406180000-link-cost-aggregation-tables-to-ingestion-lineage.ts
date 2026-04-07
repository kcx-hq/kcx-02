import { DataTypes } from "sequelize";
import type { QueryInterface } from "sequelize";

type AggTableConfig = {
  tableName: string;
  bucketColumn: string;
  oldUniqueIndexName: string;
  newUniqueIndexName: string;
};

const AGG_TABLES: AggTableConfig[] = [
  {
    tableName: "agg_cost_hourly",
    bucketColumn: "hour_start",
    oldUniqueIndexName: "uq_agg_cost_hourly_bucket_dims_currency",
    newUniqueIndexName: "uq_agg_cost_hourly_tenant_bucket_dims_currency",
  },
  {
    tableName: "agg_cost_daily",
    bucketColumn: "usage_date",
    oldUniqueIndexName: "uq_agg_cost_daily_bucket_dims_currency",
    newUniqueIndexName: "uq_agg_cost_daily_tenant_bucket_dims_currency",
  },
  {
    tableName: "agg_cost_monthly",
    bucketColumn: "month_start",
    oldUniqueIndexName: "uq_agg_cost_monthly_bucket_dims_currency",
    newUniqueIndexName: "uq_agg_cost_monthly_tenant_bucket_dims_currency",
  },
];

const hasTable = async (queryInterface: QueryInterface, tableName: string): Promise<boolean> => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const hasColumn = async (
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string,
): Promise<boolean> => {
  try {
    const schema = await queryInterface.describeTable(tableName);
    return Boolean(schema?.[columnName]);
  } catch {
    return false;
  }
};

const ensureForeignKeyConstraint = async (
  queryInterface: QueryInterface,
  {
    tableName,
    constraintName,
    columnName,
    referencedTable,
    referencedColumn,
    onDeleteAction,
  }: {
    tableName: string;
    constraintName: string;
    columnName: string;
    referencedTable: string;
    referencedColumn: string;
    onDeleteAction: "CASCADE" | "SET NULL" | "RESTRICT";
  },
): Promise<void> => {
  await queryInterface.sequelize.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = '${constraintName}'
  ) THEN
    ALTER TABLE public.${tableName}
    ADD CONSTRAINT ${constraintName}
    FOREIGN KEY (${columnName})
    REFERENCES public.${referencedTable}(${referencedColumn})
    ON DELETE ${onDeleteAction};
  END IF;
END $$;
`);
};

const dropConstraintIfExists = async (
  queryInterface: QueryInterface,
  tableName: string,
  constraintName: string,
): Promise<void> => {
  await queryInterface.sequelize.query(`
ALTER TABLE IF EXISTS public.${tableName}
DROP CONSTRAINT IF EXISTS ${constraintName};
`);
};

const migration = {
  async up(queryInterface: QueryInterface) {
    for (const table of AGG_TABLES) {
      if (!(await hasTable(queryInterface, table.tableName))) {
        continue;
      }

      await queryInterface.sequelize.query(`
ALTER TABLE public.${table.tableName}
  ALTER COLUMN service_key TYPE BIGINT USING service_key::BIGINT,
  ALTER COLUMN sub_account_key TYPE BIGINT USING sub_account_key::BIGINT,
  ALTER COLUMN region_key TYPE BIGINT USING region_key::BIGINT;
`);

      if (!(await hasColumn(queryInterface, table.tableName, "tenant_id"))) {
        await queryInterface.addColumn(table.tableName, "tenant_id", {
          type: DataTypes.UUID,
          allowNull: true,
        });
      }

      if (!(await hasColumn(queryInterface, table.tableName, "billing_source_id"))) {
        await queryInterface.addColumn(table.tableName, "billing_source_id", {
          type: DataTypes.BIGINT,
          allowNull: true,
        });
      }

      if (!(await hasColumn(queryInterface, table.tableName, "ingestion_run_id"))) {
        await queryInterface.addColumn(table.tableName, "ingestion_run_id", {
          type: DataTypes.BIGINT,
          allowNull: true,
        });
      }

      if (!(await hasColumn(queryInterface, table.tableName, "provider_id"))) {
        await queryInterface.addColumn(table.tableName, "provider_id", {
          type: DataTypes.BIGINT,
          allowNull: true,
        });
      }

      if (!(await hasColumn(queryInterface, table.tableName, "uploaded_by"))) {
        await queryInterface.addColumn(table.tableName, "uploaded_by", {
          type: DataTypes.UUID,
          allowNull: true,
        });
      }

      await queryInterface.sequelize.query(`
CREATE INDEX IF NOT EXISTS idx_${table.tableName}_tenant_id
  ON public.${table.tableName}(tenant_id);
CREATE INDEX IF NOT EXISTS idx_${table.tableName}_billing_source_id
  ON public.${table.tableName}(billing_source_id);
CREATE INDEX IF NOT EXISTS idx_${table.tableName}_ingestion_run_id
  ON public.${table.tableName}(ingestion_run_id);
CREATE INDEX IF NOT EXISTS idx_${table.tableName}_provider_id
  ON public.${table.tableName}(provider_id);
CREATE INDEX IF NOT EXISTS idx_${table.tableName}_uploaded_by
  ON public.${table.tableName}(uploaded_by);
`);

      await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS public.${table.oldUniqueIndexName};
DROP INDEX IF EXISTS public.${table.newUniqueIndexName};
CREATE UNIQUE INDEX IF NOT EXISTS ${table.newUniqueIndexName}
  ON public.${table.tableName}(tenant_id, ${table.bucketColumn}, service_key, sub_account_key, region_key, currency_code);
`);

      await ensureForeignKeyConstraint(queryInterface, {
        tableName: table.tableName,
        constraintName: `fk_${table.tableName}_tenant_id`,
        columnName: "tenant_id",
        referencedTable: "tenants",
        referencedColumn: "id",
        onDeleteAction: "CASCADE",
      });
      await ensureForeignKeyConstraint(queryInterface, {
        tableName: table.tableName,
        constraintName: `fk_${table.tableName}_billing_source_id`,
        columnName: "billing_source_id",
        referencedTable: "billing_sources",
        referencedColumn: "id",
        onDeleteAction: "SET NULL",
      });
      await ensureForeignKeyConstraint(queryInterface, {
        tableName: table.tableName,
        constraintName: `fk_${table.tableName}_ingestion_run_id`,
        columnName: "ingestion_run_id",
        referencedTable: "billing_ingestion_runs",
        referencedColumn: "id",
        onDeleteAction: "SET NULL",
      });
      await ensureForeignKeyConstraint(queryInterface, {
        tableName: table.tableName,
        constraintName: `fk_${table.tableName}_provider_id`,
        columnName: "provider_id",
        referencedTable: "cloud_providers",
        referencedColumn: "id",
        onDeleteAction: "RESTRICT",
      });
      await ensureForeignKeyConstraint(queryInterface, {
        tableName: table.tableName,
        constraintName: `fk_${table.tableName}_uploaded_by`,
        columnName: "uploaded_by",
        referencedTable: "users",
        referencedColumn: "id",
        onDeleteAction: "SET NULL",
      });
    }
  },

  async down(queryInterface: QueryInterface) {
    for (const table of AGG_TABLES) {
      if (!(await hasTable(queryInterface, table.tableName))) {
        continue;
      }

      await dropConstraintIfExists(queryInterface, table.tableName, `fk_${table.tableName}_uploaded_by`);
      await dropConstraintIfExists(queryInterface, table.tableName, `fk_${table.tableName}_provider_id`);
      await dropConstraintIfExists(queryInterface, table.tableName, `fk_${table.tableName}_ingestion_run_id`);
      await dropConstraintIfExists(queryInterface, table.tableName, `fk_${table.tableName}_billing_source_id`);
      await dropConstraintIfExists(queryInterface, table.tableName, `fk_${table.tableName}_tenant_id`);

      await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS public.idx_${table.tableName}_uploaded_by;
DROP INDEX IF EXISTS public.idx_${table.tableName}_provider_id;
DROP INDEX IF EXISTS public.idx_${table.tableName}_ingestion_run_id;
DROP INDEX IF EXISTS public.idx_${table.tableName}_billing_source_id;
DROP INDEX IF EXISTS public.idx_${table.tableName}_tenant_id;
DROP INDEX IF EXISTS public.${table.newUniqueIndexName};
CREATE UNIQUE INDEX IF NOT EXISTS ${table.oldUniqueIndexName}
  ON public.${table.tableName}(${table.bucketColumn}, service_key, sub_account_key, region_key, currency_code);
`);

      if (await hasColumn(queryInterface, table.tableName, "uploaded_by")) {
        await queryInterface.removeColumn(table.tableName, "uploaded_by");
      }
      if (await hasColumn(queryInterface, table.tableName, "provider_id")) {
        await queryInterface.removeColumn(table.tableName, "provider_id");
      }
      if (await hasColumn(queryInterface, table.tableName, "ingestion_run_id")) {
        await queryInterface.removeColumn(table.tableName, "ingestion_run_id");
      }
      if (await hasColumn(queryInterface, table.tableName, "billing_source_id")) {
        await queryInterface.removeColumn(table.tableName, "billing_source_id");
      }
      if (await hasColumn(queryInterface, table.tableName, "tenant_id")) {
        await queryInterface.removeColumn(table.tableName, "tenant_id");
      }
    }
  },
};

export default migration;
