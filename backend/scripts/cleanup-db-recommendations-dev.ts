import { Op, QueryTypes } from "sequelize";

import {
  BillingSource,
  CloudConnectionV2,
  DbCostHistoryDaily,
  DbResourceInventorySnapshot,
  DbUtilizationDaily,
  DimSubAccount,
  FactDbResourceDaily,
  sequelize,
  Tenant,
} from "../src/models/index.js";

const TENANT_SLUG = "kcx-db-rec-dev-seed";
const CONNECTION_NAME = "kcx-db-rec-dev-seed-conn";
const ACCOUNT_ID = "123456789012";
const SOURCE_NAME = "KCX DB Rec Dev Seed Source";
const SOURCE_SYSTEM = "KCX_DB_RECOMMENDATIONS_V1";

const RESOURCE_IDS = [
  "seed-db-storage-aurora-001",
  "seed-db-idle-rds-001",
  "seed-db-ha-aurora-001",
  "seed-db-engine-aurora-001",
];

async function main(): Promise<void> {
  const tenant = await Tenant.findOne({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    console.log(JSON.stringify({ cleaned: false, reason: "seed tenant not found" }, null, 2));
    return;
  }

  const connection = await CloudConnectionV2.findOne({
    where: { tenantId: String(tenant.id), connectionName: CONNECTION_NAME },
  });
  if (!connection) {
    console.log(JSON.stringify({ cleaned: false, reason: "seed cloud connection not found", tenantId: String(tenant.id) }, null, 2));
    return;
  }

  const tenantId = String(tenant.id);
  const cloudConnectionId = String(connection.id);

  const deleted = await sequelize.transaction(async (transaction) => {
    const recDeleted = await sequelize.query(
      `
      DELETE FROM fact_recommendations
      WHERE tenant_id = :tenantId::uuid
        AND cloud_connection_id = :cloudConnectionId::uuid
        AND category = 'DB'
        AND source_system = :sourceSystem
        AND resource_id IN (:resourceIds)
      `,
      {
        replacements: {
          tenantId,
          cloudConnectionId,
          sourceSystem: SOURCE_SYSTEM,
          resourceIds: RESOURCE_IDS,
        },
        type: QueryTypes.DELETE,
        transaction,
      },
    );

    const util = await DbUtilizationDaily.destroy({
      where: { tenantId, cloudConnectionId, resourceId: { [Op.in]: RESOURCE_IDS } },
      transaction,
    });
    const inv = await DbResourceInventorySnapshot.destroy({
      where: { tenantId, cloudConnectionId, resourceId: { [Op.in]: RESOURCE_IDS } },
      transaction,
    });
    const cost = await DbCostHistoryDaily.destroy({
      where: { tenantId, cloudConnectionId, resourceId: { [Op.in]: RESOURCE_IDS } },
      transaction,
    });
    const fact = await FactDbResourceDaily.destroy({
      where: { tenantId, cloudConnectionId, resourceId: { [Op.in]: RESOURCE_IDS } },
      transaction,
    });

    const billingSource = await BillingSource.findOne({
      where: {
        tenantId,
        cloudConnectionId,
        sourceName: SOURCE_NAME,
      },
      transaction,
    });
    if (billingSource) {
      await billingSource.destroy({ transaction });
    }

    const remains = await sequelize.query<{ c: number }>(
      `
      SELECT COUNT(*)::int AS c
      FROM fact_db_resource_daily
      WHERE tenant_id = :tenantId::uuid
        AND cloud_connection_id = :cloudConnectionId::uuid
      `,
      {
        replacements: { tenantId, cloudConnectionId },
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    let contextRemoved = false;
    if ((remains[0]?.c ?? 0) === 0) {
      await DimSubAccount.destroy({
        where: { tenantId, subAccountId: ACCOUNT_ID },
        transaction,
      });
      await connection.destroy({ transaction });
      await tenant.destroy({ transaction });
      contextRemoved = true;
    }

    return {
      recommendationRows: recDeleted,
      utilizationRows: util,
      inventoryRows: inv,
      costRows: cost,
      factRows: fact,
      contextRemoved,
    };
  });

  console.log(
    JSON.stringify(
      {
        cleaned: true,
        tenantId,
        cloudConnectionId,
        resources: RESOURCE_IDS,
        deleted,
      },
      null,
      2,
    ),
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
