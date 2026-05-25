import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";
import type { DashboardScope } from "../../dashboard.types.js";
import { buildDashboardFilter } from "../../shared/filter-builder.js";
import type { S3RequestCostIntelligenceInsight } from "../cost-insights/s3-cost-insights.types.js";

type RequestCostRow = {
  bucket_name: string | null;
  operation: string | null;
  request_cost: number | string | null;
  total_bucket_cost: number | string | null;
  request_count: number | string | null;
  storage_gib: number | string | null;
  object_count: number | string | null;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const S3_FILTER_SQL = `
(
  LOWER(COALESCE(ds.service_name, '')) LIKE '%s3%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%simple storage service%'
  OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%s3%'
  OR LOWER(COALESCE(dres.resource_id, '')) LIKE 'arn:aws:s3:::%'
  OR LOWER(COALESCE(dres.resource_id, '')) LIKE 's3://%'
)
`;

const S3_BUCKET_NAME_SQL = `
CASE
  WHEN COALESCE(dres.resource_id, '') = '' THEN 'unattributed'
  WHEN LOWER(dres.resource_id) LIKE 'arn:aws:s3:::%' THEN NULLIF(SPLIT_PART(dres.resource_id, ':::', 2), '')
  WHEN LOWER(dres.resource_id) LIKE 's3://%' THEN NULLIF(SPLIT_PART(SUBSTRING(dres.resource_id FROM 6), '/', 1), '')
  ELSE dres.resource_id
END
`;

export class S3RequestCostIntelligenceService {
  async getRequestCostIntelligence(
    scope: DashboardScope,
  ): Promise<{ items: S3RequestCostIntelligenceInsight[]; totalRequestCost: number }> {
    if (scope.scopeType !== "global") {
      return { items: [], totalRequestCost: 0 };
    }

    const filter = buildDashboardFilter(scope);

    const rows = await sequelize.query<RequestCostRow>(
      `
      WITH base_cost AS (
        SELECT
          COALESCE(NULLIF(${S3_BUCKET_NAME_SQL}, ''), 'unattributed') AS bucket_name,
          COALESCE(NULLIF(fcli.operation, ''), 'Unspecified') AS operation,
          COALESCE(fcli.billed_cost, 0)::double precision AS billed_cost,
          COALESCE(fcli.usage_type, '') AS usage_type,
          COALESCE(fcli.product_family, '') AS product_family
        FROM fact_cost_line_items fcli
        LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key
        LEFT JOIN dim_service ds ON ds.id = fcli.service_key
        LEFT JOIN dim_resource dres ON dres.id = fcli.resource_key
        WHERE ${filter.whereClause}
          AND ${S3_FILTER_SQL}
      ),
      request_cost_by_bucket AS (
        SELECT
          bucket_name,
          operation,
          SUM(CASE WHEN LOWER(usage_type) LIKE 'requests%' THEN billed_cost ELSE 0 END)::double precision AS request_cost,
          SUM(billed_cost)::double precision AS total_bucket_cost
        FROM base_cost
        GROUP BY bucket_name, operation
      ),
      request_count_latest AS (
        SELECT DISTINCT ON (sld.bucket_name)
          sld.bucket_name,
          (COALESCE(sld.get_requests_count, 0) + COALESCE(sld.put_requests_count, 0))::double precision AS request_count,
          (
            COALESCE(sld.bytes_standard, 0) +
            COALESCE(sld.bytes_standard_ia, 0) +
            COALESCE(sld.bytes_onezone_ia, 0) +
            COALESCE(sld.bytes_intelligent_tiering, 0) +
            COALESCE(sld.bytes_glacier, 0) +
            COALESCE(sld.bytes_deep_archive, 0)
          )::double precision / 1024 / 1024 / 1024 AS storage_gib,
          COALESCE(sld.object_count, 0)::double precision AS object_count
        FROM s3_storage_lens_daily sld
        WHERE sld.tenant_id = $1::uuid
          AND sld.usage_date >= $2::date
          AND sld.usage_date <= $3::date
        ORDER BY sld.bucket_name ASC, sld.usage_date DESC
      )
      SELECT
        rc.bucket_name,
        rc.operation,
        rc.request_cost,
        rc.total_bucket_cost,
        rl.request_count,
        rl.storage_gib,
        rl.object_count
      FROM request_cost_by_bucket rc
      LEFT JOIN request_count_latest rl ON rl.bucket_name = rc.bucket_name
      WHERE rc.request_cost > 0
      ORDER BY rc.request_cost DESC, rc.bucket_name ASC
      LIMIT 1000
      `,
      {
        bind: filter.params,
        type: QueryTypes.SELECT,
      },
    );

    const items = rows.map<S3RequestCostIntelligenceInsight>((row) => {
      const requestCost = toNumber(row.request_cost);
      const totalBucketCost = toNumber(row.total_bucket_cost);
      const requestCount = toNumber(row.request_count);
      const storageGib = toNumber(row.storage_gib);
      const objectCount = toNumber(row.object_count);
      const requestCostPct = totalBucketCost > 0 ? (requestCost / totalBucketCost) * 100 : 0;
      const costPer1kRequests = requestCount > 0 ? (requestCost / requestCount) * 1000 : 0;
      const costPerGb = storageGib > 0 ? requestCost / storageGib : null;
      const anomalyFlag = requestCostPct > 35 || costPer1kRequests > 0.2;

      return {
        bucketName: String(row.bucket_name ?? "unattributed"),
        operation: String(row.operation ?? "Unspecified"),
        requestCount,
        requestCost,
        requestCostPercentage: requestCostPct,
        costPer1kRequests,
        costPerGb,
        anomalyFlag,
        recommendation: anomalyFlag
          ? "Review application request patterns (LIST/GET/PUT) and add caching/prefix partitioning."
          : "Request profile is within expected range.",
      };
    });

    const totalRequestCost = items.reduce((sum, item) => sum + item.requestCost, 0);
    return { items, totalRequestCost };
  }
}

