import { QueryTypes } from "sequelize";

import { FactRecommendations, sequelize } from "../src/models/index.js";

const TEST_RESOURCE_ID = "arn:aws:rds:us-east-1:231016597055:db:kcx-dev-recommendation-test";

type ScopeRow = {
  tenantId: string;
  cloudConnectionId: string;
};

async function resolveScopes(): Promise<ScopeRow[]> {
  return sequelize.query<ScopeRow>(
    `
    SELECT DISTINCT
      tenant_id AS "tenantId",
      cloud_connection_id AS "cloudConnectionId"
    FROM fact_db_resource_daily
    WHERE resource_id = :resourceId
      AND cloud_connection_id IS NOT NULL
    `,
    {
      replacements: { resourceId: TEST_RESOURCE_ID },
      type: QueryTypes.SELECT,
    },
  );
}

async function cleanupScope(scope: ScopeRow): Promise<void> {
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

async function run(): Promise<void> {
  const scopes = await resolveScopes();
  if (scopes.length === 0) {
    console.log(
      JSON.stringify(
        {
          cleaned: false,
          reason: "No seeded dev test resource found",
          resourceId: TEST_RESOURCE_ID,
        },
        null,
        2,
      ),
    );
    return;
  }

  for (const scope of scopes) {
    await cleanupScope(scope);
  }

  console.log(
    JSON.stringify(
      {
        cleaned: true,
        resourceId: TEST_RESOURCE_ID,
        scopes,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

