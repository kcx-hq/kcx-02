import { QueryTypes } from "sequelize";

import { DbRecommendationsService } from "../src/features/database/recommendations/db-recommendations.service.js";
import { FactRecommendations, sequelize } from "../src/models/index.js";

const TEST_RESOURCE_ID = "arn:aws:rds:us-east-1:231016597055:db:kcx-dev-recommendation-test";
const TEST_RESOURCE_NAME = "kcx-dev-recommendation-test";
const TEST_RESOURCE_TYPE = "instance";
const TEST_DB_SERVICE = "AmazonRDS";
const TEST_DB_ENGINE = "PostgreSQL";
const LOOKBACK_DAYS = 30;

const isoDateOnly = (value: Date): string => value.toISOString().slice(0, 10);
const monthStartDateOnly = (value: Date): string => `${value.toISOString().slice(0, 7)}-01`;

function log(title: string, data: unknown): void {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(data, null, 2));
}

type ScopeRow = {
  tenantId: string;
  cloudConnectionId: string;
  billingSourceId: number | null;
  providerId: number | null;
  regionKey: number | null;
  subAccountKey: number | null;
  resourceKey: number | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
};

async function resolveSeedScope(): Promise<ScopeRow> {
  const rows = await sequelize.query<ScopeRow>(
    `
    SELECT
      f.tenant_id AS "tenantId",
      f.cloud_connection_id AS "cloudConnectionId",
      f.billing_source_id::bigint AS "billingSourceId",
      f.provider_id::bigint AS "providerId",
      f.region_key::bigint AS "regionKey",
      f.sub_account_key::bigint AS "subAccountKey",
      f.resource_key::bigint AS "resourceKey",
      COALESCE(sa.sub_account_id, f.sub_account_key::text) AS "awsAccountId",
      r.region_id AS "awsRegionCode"
    FROM fact_db_resource_daily f
    LEFT JOIN dim_sub_account sa ON sa.id = f.sub_account_key
    LEFT JOIN dim_region r ON r.id = f.region_key
    WHERE f.cloud_connection_id IS NOT NULL
      AND f.tenant_id IS NOT NULL
      AND f.db_service ILIKE '%rds%'
    ORDER BY f.usage_date DESC
    LIMIT 1
    `,
    { type: QueryTypes.SELECT },
  );

  if (!rows.length) {
    throw new Error("No existing RDS/Aurora scope found in fact_db_resource_daily to seed test data.");
  }

  return rows[0];
}

async function clearTestFootprint(scope: ScopeRow): Promise<void> {
  await sequelize.query(
    `
    DELETE FROM db_utilization_daily
    WHERE tenant_id = :tenantId::uuid
      AND cloud_connection_id = :cloudConnectionId::uuid
      AND resource_id = :resourceId
    `,
    {
      replacements: {
        tenantId: scope.tenantId,
        cloudConnectionId: scope.cloudConnectionId,
        resourceId: TEST_RESOURCE_ID,
      },
      type: QueryTypes.DELETE,
    },
  );

  await sequelize.query(
    `
    DELETE FROM db_resource_inventory_snapshots
    WHERE tenant_id = :tenantId::uuid
      AND cloud_connection_id = :cloudConnectionId::uuid
      AND resource_id = :resourceId
    `,
    {
      replacements: {
        tenantId: scope.tenantId,
        cloudConnectionId: scope.cloudConnectionId,
        resourceId: TEST_RESOURCE_ID,
      },
      type: QueryTypes.DELETE,
    },
  );

  await sequelize.query(
    `
    DELETE FROM db_cost_history_daily
    WHERE tenant_id = :tenantId::uuid
      AND cloud_connection_id = :cloudConnectionId::uuid
      AND resource_id = :resourceId
    `,
    {
      replacements: {
        tenantId: scope.tenantId,
        cloudConnectionId: scope.cloudConnectionId,
        resourceId: TEST_RESOURCE_ID,
      },
      type: QueryTypes.DELETE,
    },
  );

  await sequelize.query(
    `
    DELETE FROM fact_db_resource_daily
    WHERE tenant_id = :tenantId::uuid
      AND cloud_connection_id = :cloudConnectionId::uuid
      AND resource_id = :resourceId
    `,
    {
      replacements: {
        tenantId: scope.tenantId,
        cloudConnectionId: scope.cloudConnectionId,
        resourceId: TEST_RESOURCE_ID,
      },
      type: QueryTypes.DELETE,
    },
  );

  await FactRecommendations.destroy({
    where: {
      tenantId: scope.tenantId,
      cloudConnectionId: scope.cloudConnectionId,
      category: "DB",
      sourceSystem: "KCX_DB_RECOMMENDATIONS_V1",
      resourceId: TEST_RESOURCE_ID,
    },
  });
}

async function seedData(scope: ScopeRow): Promise<{ usageDate: string }> {
  const usageDate = new Date();
  usageDate.setUTCDate(usageDate.getUTCDate() - 1);
  const usageDateOnly = isoDateOnly(usageDate);
  const monthStart = monthStartDateOnly(usageDate);

  await sequelize.query(
    `
    INSERT INTO fact_db_resource_daily (
      tenant_id, cloud_connection_id, billing_source_id, provider_id, usage_date,
      resource_id, resource_arn, resource_name, db_service, db_engine, resource_type,
      resource_key, region_key, sub_account_key, status, cluster_id, is_cluster_resource,
      compute_cost, storage_cost, io_cost, backup_cost, data_transfer_cost, tax_cost,
      credit_amount, refund_amount, total_billed_cost, total_effective_cost, total_list_cost, currency_code
    )
    VALUES (
      :tenantId::uuid, :cloudConnectionId::uuid, :billingSourceId::bigint, :providerId::bigint, :usageDate::date,
      :resourceId, :resourceId, :resourceName, :dbService, :dbEngine, :resourceType,
      :resourceKey::bigint, :regionKey::bigint, :subAccountKey::bigint, 'available', NULL, FALSE,
      3, 4, 1, 2, 0, 0,
      0, 0, 10, 10, 10, 'USD'
    )
    `,
    {
      replacements: {
        tenantId: scope.tenantId,
        cloudConnectionId: scope.cloudConnectionId,
        billingSourceId: scope.billingSourceId,
        providerId: scope.providerId,
        usageDate: usageDateOnly,
        resourceId: TEST_RESOURCE_ID,
        resourceName: TEST_RESOURCE_NAME,
        dbService: TEST_DB_SERVICE,
        dbEngine: TEST_DB_ENGINE,
        resourceType: TEST_RESOURCE_TYPE,
        resourceKey: scope.resourceKey,
        regionKey: scope.regionKey,
        subAccountKey: scope.subAccountKey,
      },
      type: QueryTypes.INSERT,
    },
  );

  const costRows = [
    { costCategory: "compute", effectiveCost: 3 },
    { costCategory: "storage", effectiveCost: 4 },
    { costCategory: "backup", effectiveCost: 2 },
    { costCategory: "io", effectiveCost: 1 },
  ];

  for (const row of costRows) {
    await sequelize.query(
      `
      INSERT INTO db_cost_history_daily (
        usage_date, month_start, tenant_id, cloud_connection_id, billing_source_id, provider_id,
        service_key, region_key, sub_account_key, resource_key,
        resource_id, db_service, db_engine, cost_category,
        billed_cost, effective_cost, list_cost, usage_quantity, currency_code, ingestion_run_id
      )
      VALUES (
        :usageDate::date, :monthStart::date, :tenantId::uuid, :cloudConnectionId::uuid, :billingSourceId::bigint, :providerId::bigint,
        NULL, :regionKey::bigint, :subAccountKey::bigint, :resourceKey::bigint,
        :resourceId, :dbService, :dbEngine, :costCategory,
        :effectiveCost, :effectiveCost, :effectiveCost, NULL, 'USD', NULL
      )
      `,
      {
        replacements: {
          usageDate: usageDateOnly,
          monthStart,
          tenantId: scope.tenantId,
          cloudConnectionId: scope.cloudConnectionId,
          billingSourceId: scope.billingSourceId,
          providerId: scope.providerId,
          regionKey: scope.regionKey,
          subAccountKey: scope.subAccountKey,
          resourceKey: scope.resourceKey,
          resourceId: TEST_RESOURCE_ID,
          dbService: TEST_DB_SERVICE,
          dbEngine: TEST_DB_ENGINE,
          costCategory: row.costCategory,
          effectiveCost: row.effectiveCost,
        },
        type: QueryTypes.INSERT,
      },
    );
  }

  await sequelize.query(
    `
    INSERT INTO db_resource_inventory_snapshots (
      tenant_id, cloud_connection_id, provider_id, resource_id, resource_arn, resource_name,
      db_service, db_engine, resource_type, resource_key, region_key, sub_account_key, status,
      allocated_storage_gb, data_footprint_gb, instance_class, capacity_mode, cluster_id, is_cluster_resource,
      tags_json, metadata_json, discovered_at, is_current, deleted_at
    )
    VALUES (
      :tenantId::uuid, :cloudConnectionId::uuid, :providerId::bigint, :resourceId, :resourceId, :resourceName,
      :dbService, :dbEngine, :resourceType, :resourceKey::bigint, :regionKey::bigint, :subAccountKey::bigint, 'available',
      200, 120, 'db.m6g.large', 'provisioned', NULL, FALSE,
      '{}'::jsonb, '{"dev_test":"kcx-db-rec"}'::jsonb, NOW(), TRUE, NULL
    )
    `,
    {
      replacements: {
        tenantId: scope.tenantId,
        cloudConnectionId: scope.cloudConnectionId,
        providerId: scope.providerId,
        resourceId: TEST_RESOURCE_ID,
        resourceName: TEST_RESOURCE_NAME,
        dbService: TEST_DB_SERVICE,
        dbEngine: TEST_DB_ENGINE,
        resourceType: TEST_RESOURCE_TYPE,
        resourceKey: scope.resourceKey,
        regionKey: scope.regionKey,
        subAccountKey: scope.subAccountKey,
      },
      type: QueryTypes.INSERT,
    },
  );

  return { usageDate: usageDateOnly };
}

async function run(): Promise<void> {
  const service = new DbRecommendationsService();
  const scope = await resolveSeedScope();

  log("SEED_SCOPE", {
    tenantId: scope.tenantId,
    cloudConnectionId: scope.cloudConnectionId,
    billingSourceId: scope.billingSourceId,
    providerId: scope.providerId,
    regionKey: scope.regionKey,
    subAccountKey: scope.subAccountKey,
    resourceKey: scope.resourceKey,
    awsAccountId: scope.awsAccountId,
    awsRegionCode: scope.awsRegionCode,
    lookbackDays: LOOKBACK_DAYS,
  });

  await clearTestFootprint(scope);
  const seeded = await seedData(scope);
  log("SEED_INSERTED", { resourceId: TEST_RESOURCE_ID, usageDate: seeded.usageDate });

  const generate1 = await service.generate({
    tenantId: scope.tenantId,
    cloudConnectionId: scope.cloudConnectionId,
    billingSourceId: scope.billingSourceId ?? undefined,
  });
  const generate2 = await service.generate({
    tenantId: scope.tenantId,
    cloudConnectionId: scope.cloudConnectionId,
    billingSourceId: scope.billingSourceId ?? undefined,
  });

  const list = await service.list({
    tenantId: scope.tenantId,
    cloudConnectionId: scope.cloudConnectionId,
    page: 1,
    limit: 20,
    recommendationType: "DB_STORAGE_OPTIMIZATION",
    resourceId: TEST_RESOURCE_ID,
    sortBy: "updated_at",
    sortOrder: "desc",
  });

  const summary = await service.getSummary({
    tenantId: scope.tenantId,
    cloudConnectionId: scope.cloudConnectionId,
  });

  const firstId = list.items[0]?.id;
  const detail = firstId
    ? await service.getById({ tenantId: scope.tenantId, id: firstId })
    : null;

  const filterChecks = {
    byRecommendationType: (await service.list({
      tenantId: scope.tenantId,
      cloudConnectionId: scope.cloudConnectionId,
      page: 1,
      limit: 10,
      recommendationType: "DB_STORAGE_OPTIMIZATION",
    })).items.length,
    byStatusOpen: (await service.list({
      tenantId: scope.tenantId,
      cloudConnectionId: scope.cloudConnectionId,
      page: 1,
      limit: 10,
      status: "OPEN",
    })).items.length,
    byConfidence: list.items[0]?.confidence
      ? (await service.list({
          tenantId: scope.tenantId,
          cloudConnectionId: scope.cloudConnectionId,
          page: 1,
          limit: 10,
          confidence: list.items[0].confidence,
        })).items.length
      : 0,
    byEvidenceLevel: list.items[0]?.evidence_level
      ? (await service.list({
          tenantId: scope.tenantId,
          cloudConnectionId: scope.cloudConnectionId,
          page: 1,
          limit: 10,
          evidenceLevel: list.items[0].evidence_level,
        })).items.length
      : 0,
    byResourceId: (await service.list({
      tenantId: scope.tenantId,
      cloudConnectionId: scope.cloudConnectionId,
      page: 1,
      limit: 10,
      resourceId: TEST_RESOURCE_ID,
    })).items.length,
  };

  const activeDuplicateRows = await sequelize.query(
    `
    SELECT resource_id, recommendation_type, COUNT(*)::int AS duplicate_count
    FROM fact_recommendations
    WHERE tenant_id = :tenantId::uuid
      AND cloud_connection_id = :cloudConnectionId::uuid
      AND category = 'DB'
      AND resource_id = :resourceId
      AND status IN ('OPEN', 'IN_PROGRESS', 'SNOOZED', 'DISMISSED')
    GROUP BY resource_id, recommendation_type
    HAVING COUNT(*) > 1
    `,
    {
      replacements: {
        tenantId: scope.tenantId,
        cloudConnectionId: scope.cloudConnectionId,
        resourceId: TEST_RESOURCE_ID,
      },
      type: QueryTypes.SELECT,
    },
  );

  log("GENERATION_RUN_1", generate1);
  log("GENERATION_RUN_2", generate2);
  log("LIST_RESPONSE", list);
  log("SUMMARY_RESPONSE", summary);
  log("DETAIL_RESPONSE", detail);
  log("FILTER_CHECKS", filterChecks);
  log("IDEMPOTENCY_DUPLICATE_CHECK", { duplicateActiveRows: activeDuplicateRows });
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

