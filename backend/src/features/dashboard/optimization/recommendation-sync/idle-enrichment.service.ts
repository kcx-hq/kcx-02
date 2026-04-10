import { QueryTypes } from "sequelize";
import { sequelize } from "../../../../models/index.js";
import type {
  EnrichedIdleRecommendation,
  IdleResourceType,
  NormalizedIdleRecommendation,
} from "./types.js";

type SubAccountRow = { id: number | string; sub_account_id: string };
type RegionRow = { id: number | string; region_id: string | null; region_name: string | null };
type ServiceRow = { id: number | string; service_name: string | null };
type ResourceCostRow = { resource_id: string; billed_cost_30d: number | string | null };
type AccountRegionServiceCostRow = {
  sub_account_key: number | string | null;
  region_key: number | string | null;
  service_key: number | string | null;
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

const mapToKey = (
  subAccountKey: number | null,
  regionKey: number | null,
  serviceKey: number | null,
): string => `${subAccountKey ?? "null"}::${regionKey ?? "null"}::${serviceKey ?? "null"}`;

const pickServiceKey = ({
  resourceType,
  ec2ServiceKey,
  lbServiceKey,
}: {
  resourceType: IdleResourceType | null;
  ec2ServiceKey: number | null;
  lbServiceKey: number | null;
}): number | null => {
  if (resourceType === "ALB" || resourceType === "NLB") {
    return lbServiceKey ?? ec2ServiceKey;
  }
  return ec2ServiceKey;
};

export async function enrichIdleRecommendations({
  tenantId,
  providerId,
  cloudConnectionId,
  billingSourceId,
  normalizedRecords,
}: {
  tenantId: string;
  providerId: string;
  cloudConnectionId: string;
  billingSourceId?: string | number | null;
  normalizedRecords: NormalizedIdleRecommendation[];
}): Promise<EnrichedIdleRecommendation[]> {
  if (normalizedRecords.length === 0) {
    return [];
  }

  const distinctAccountIds = Array.from(new Set(normalizedRecords.map((item) => item.awsAccountId)));
  const distinctRegions = Array.from(new Set(normalizedRecords.map((item) => item.awsRegionCode.toLowerCase())));
  const distinctResourceIds = Array.from(new Set(normalizedRecords.map((item) => item.resourceId)));

  const [subAccountRows, regionRows, serviceRows, resourceCostRows] = await Promise.all([
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
        SELECT ds.id, ds.service_name
        FROM dim_service ds
        WHERE ds.provider_id = $1
          AND LOWER(COALESCE(ds.service_name, '')) IN (
            'amazon elastic compute cloud',
            'amazonec2',
            'ec2',
            'elastic compute cloud',
            'elastic load balancing',
            'awselasticloadbalancing',
            'amazon elastic load balancing'
          );
      `,
      {
        bind: [providerId],
        type: QueryTypes.SELECT,
      },
    ),
    sequelize.query<ResourceCostRow>(
      `
        SELECT
          dr.resource_id,
          COALESCE(SUM(fcli.billed_cost), 0)::double precision AS billed_cost_30d
        FROM fact_cost_line_items fcli
        INNER JOIN dim_resource dr
          ON dr.id = fcli.resource_key
        INNER JOIN dim_date dd
          ON dd.id = fcli.usage_date_key
        WHERE fcli.tenant_id = $1
          AND dr.tenant_id = $1
          AND dr.provider_id = $2
          AND dr.resource_id = ANY($3::text[])
          AND dd.full_date >= CURRENT_DATE - INTERVAL '30 days'
          AND ($4::bigint IS NULL OR fcli.billing_source_id = $4::bigint)
        GROUP BY dr.resource_id;
      `,
      {
        bind: [
          tenantId,
          providerId,
          distinctResourceIds,
          billingSourceId === null || typeof billingSourceId === "undefined"
            ? null
            : Number(billingSourceId),
        ],
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

  let ec2ServiceKey: number | null = null;
  let lbServiceKey: number | null = null;
  for (const row of serviceRows) {
    const serviceName = String(row.service_name ?? "").trim().toLowerCase();
    if (
      ec2ServiceKey === null &&
      (serviceName.includes("elastic compute") || serviceName.includes("amazonec2") || serviceName === "ec2")
    ) {
      ec2ServiceKey = Number(row.id);
    }
    if (
      lbServiceKey === null &&
      (serviceName.includes("load balancing") || serviceName.includes("elasticloadbalancing"))
    ) {
      lbServiceKey = Number(row.id);
    }
  }

  const resourceCostById = new Map<string, number>();
  for (const row of resourceCostRows) {
    const resourceId = String(row.resource_id ?? "").trim();
    if (!resourceId) continue;
    resourceCostById.set(resourceId, toNumber(row.billed_cost_30d));
  }

  const subAccountKeys = Array.from(new Set([...subAccountKeyById.values()]));
  const regionKeys = Array.from(new Set([...regionKeyByCode.values()]));
  const serviceKeys = Array.from(
    new Set([ec2ServiceKey, lbServiceKey].filter((value): value is number => value !== null)),
  );

  const accountRegionServiceCostRows =
    subAccountKeys.length > 0 && regionKeys.length > 0 && serviceKeys.length > 0
      ? await sequelize.query<AccountRegionServiceCostRow>(
          `
            SELECT
              acd.sub_account_key,
              acd.region_key,
              acd.service_key,
              COALESCE(SUM(acd.billed_cost), 0)::double precision AS billed_cost_30d
            FROM agg_cost_daily acd
            WHERE acd.tenant_id = $1
              AND acd.service_key = ANY($2::bigint[])
              AND acd.sub_account_key = ANY($3::bigint[])
              AND acd.region_key = ANY($4::bigint[])
              AND acd.usage_date >= CURRENT_DATE - INTERVAL '30 days'
              AND ($5::bigint IS NULL OR acd.billing_source_id = $5::bigint)
            GROUP BY acd.sub_account_key, acd.region_key, acd.service_key;
          `,
          {
            bind: [
              tenantId,
              serviceKeys,
              subAccountKeys,
              regionKeys,
              billingSourceId === null || typeof billingSourceId === "undefined"
                ? null
                : Number(billingSourceId),
            ],
            type: QueryTypes.SELECT,
          },
        )
      : [];

  const accountRegionServiceCost = new Map<string, number>();
  for (const row of accountRegionServiceCostRows) {
    const key = mapToKey(
      row.sub_account_key === null ? null : Number(row.sub_account_key),
      row.region_key === null ? null : Number(row.region_key),
      row.service_key === null ? null : Number(row.service_key),
    );
    accountRegionServiceCost.set(key, toNumber(row.billed_cost_30d));
  }

  return normalizedRecords.map((record) => {
    const subAccountKey = subAccountKeyById.get(record.awsAccountId) ?? null;
    const regionKey =
      regionKeyByCode.get(record.awsRegionCode.toLowerCase()) ??
      regionKeyByCode.get(record.awsRegionCode.trim().toLowerCase()) ??
      null;
    const serviceKey = pickServiceKey({
      resourceType: record.resourceType,
      ec2ServiceKey,
      lbServiceKey,
    });

    const resourceMonthlyCost = resourceCostById.get(record.resourceId);
    const fallbackMonthlyCost =
      subAccountKey !== null && regionKey !== null && serviceKey !== null
        ? accountRegionServiceCost.get(mapToKey(subAccountKey, regionKey, serviceKey))
        : undefined;

    const currentMonthlyCost = Math.max(0, resourceMonthlyCost ?? fallbackMonthlyCost ?? 0);
    const estimatedMonthlySavings =
      record.estimatedMonthlySavings > 0 ? record.estimatedMonthlySavings : currentMonthlyCost;
    const projectedMonthlyCost = Math.max(0, currentMonthlyCost - estimatedMonthlySavings);

    return {
      ...record,
      cloudConnectionId,
      billingSourceId: billingSourceId ?? null,
      serviceKey,
      subAccountKey,
      regionKey,
      currentMonthlyCost,
      estimatedMonthlySavings,
      projectedMonthlyCost,
    };
  });
}
