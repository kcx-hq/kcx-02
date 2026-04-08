import { QueryTypes } from "sequelize";
import { sequelize } from "../../../../models/index.js";
import type {
  EnrichedRightsizingRecommendation,
  NormalizedRightsizingRecommendation,
} from "./types.js";

type SubAccountRow = { id: number | string; sub_account_id: string };
type RegionRow = { id: number | string; region_id: string | null; region_name: string | null };
type ServiceRow = { id: number | string };
type CostRow = {
  sub_account_key: number | string | null;
  region_key: number | string | null;
  billed_cost_30d: number | string | null;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const mapToKey = (accountKey: number | null, regionKey: number | null): string =>
  `${accountKey ?? "null"}::${regionKey ?? "null"}`;

export async function enrichRightsizingRecommendations({
  tenantId,
  providerId,
  normalizedRecords,
}: {
  tenantId: string;
  providerId: string;
  normalizedRecords: NormalizedRightsizingRecommendation[];
}): Promise<EnrichedRightsizingRecommendation[]> {
  if (normalizedRecords.length === 0) {
    return [];
  }

  const distinctAccountIds = Array.from(new Set(normalizedRecords.map((item) => item.awsAccountId)));
  const distinctRegions = Array.from(new Set(normalizedRecords.map((item) => item.awsRegionCode.toLowerCase())));

  const [subAccountRows, regionRows, serviceRows] = await Promise.all([
    sequelize.query<SubAccountRow>(
      `
        SELECT dsa.id, dsa.sub_account_id
        FROM dim_sub_account dsa
        WHERE dsa.tenant_id = $1
          AND dsa.provider_id = $2
          AND dsa.sub_account_id = ANY($3::text[]);
      `,
      {
        bind: [tenantId, providerId, distinctAccountIds],
        type: QueryTypes.SELECT,
      },
    ),
    sequelize.query<RegionRow>(
      `
        SELECT dr.id, dr.region_id, dr.region_name
        FROM dim_region dr
        WHERE dr.provider_id = $1
          AND (
            LOWER(COALESCE(dr.region_id, '')) = ANY($2::text[])
            OR LOWER(COALESCE(dr.region_name, '')) = ANY($2::text[])
          );
      `,
      {
        bind: [providerId, distinctRegions],
        type: QueryTypes.SELECT,
      },
    ),
    sequelize.query<ServiceRow>(
      `
        SELECT ds.id
        FROM dim_service ds
        WHERE ds.provider_id = $1
          AND LOWER(ds.service_name) IN ('amazon elastic compute cloud', 'amazonec2', 'ec2', 'elastic compute cloud')
        ORDER BY ds.id
        LIMIT 1;
      `,
      {
        bind: [providerId],
        type: QueryTypes.SELECT,
      },
    ),
  ]);

  const subAccountKeyById = new Map<string, number>();
  for (const row of subAccountRows) {
    subAccountKeyById.set(row.sub_account_id, Number(row.id));
  }

  const regionKeyByCode = new Map<string, number>();
  for (const row of regionRows) {
    const regionId = String(row.region_id ?? "").trim().toLowerCase();
    const regionName = String(row.region_name ?? "").trim().toLowerCase();
    const numericId = Number(row.id);
    if (regionId) {
      regionKeyByCode.set(regionId, numericId);
    }
    if (regionName && !regionKeyByCode.has(regionName)) {
      regionKeyByCode.set(regionName, numericId);
    }
  }

  const serviceKey = serviceRows.length > 0 ? Number(serviceRows[0].id) : null;

  const subAccountKeys = Array.from(new Set([...subAccountKeyById.values()]));
  const regionKeys = Array.from(new Set([...regionKeyByCode.values()]));
  const costRows =
    serviceKey !== null && subAccountKeys.length > 0 && regionKeys.length > 0
      ? await sequelize.query<CostRow>(
          `
            SELECT
              acd.sub_account_key,
              acd.region_key,
              COALESCE(SUM(acd.billed_cost), 0)::double precision AS billed_cost_30d
            FROM agg_cost_daily acd
            WHERE acd.tenant_id = $1
              AND acd.service_key = $2
              AND acd.sub_account_key = ANY($3::bigint[])
              AND acd.region_key = ANY($4::bigint[])
              AND acd.usage_date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY acd.sub_account_key, acd.region_key;
          `,
          {
            bind: [tenantId, serviceKey, subAccountKeys, regionKeys],
            type: QueryTypes.SELECT,
          },
        )
      : [];

  const monthlyCostByDim = new Map<string, number>();
  for (const row of costRows) {
    const key = mapToKey(
      row.sub_account_key === null ? null : Number(row.sub_account_key),
      row.region_key === null ? null : Number(row.region_key),
    );
    monthlyCostByDim.set(key, toNumber(row.billed_cost_30d));
  }

  return normalizedRecords.map((record) => {
    const subAccountKey = subAccountKeyById.get(record.awsAccountId) ?? null;
    const regionKey =
      regionKeyByCode.get(record.awsRegionCode.toLowerCase()) ??
      regionKeyByCode.get(record.awsRegionCode.trim().toLowerCase()) ??
      null;

    const currentMonthlyCost =
      subAccountKey !== null && regionKey !== null
        ? monthlyCostByDim.get(mapToKey(subAccountKey, regionKey)) ?? 0
        : 0;
    const projectedMonthlyCost = Math.max(0, currentMonthlyCost - record.estimatedMonthlySavings);

    return {
      ...record,
      serviceKey,
      subAccountKey,
      regionKey,
      currentMonthlyCost,
      projectedMonthlyCost,
    };
  });
}

