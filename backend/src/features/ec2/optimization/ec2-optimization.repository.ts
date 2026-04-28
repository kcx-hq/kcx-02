import { QueryTypes } from "sequelize";

import { FactRecommendations, sequelize } from "../../../models/index.js";
import type {
  Ec2OptimizationAggregatedInstance,
  Ec2OptimizationEbsWasteCandidate,
  Ec2OptimizationRecommendationsQuery,
  Ec2OptimizationPersistableRecommendation,
  Ec2OptimizationPersistedRecommendationType,
  Ec2OptimizationSummaryQuery,
  PersistEc2RecommendationsInput,
  PersistEc2RecommendationsResult,
  PersistedEc2InstanceRecommendation,
} from "./ec2-optimization.types.js";

const EC2_RECOMMENDATION_SOURCE_SYSTEM = "KCX_EC2_OPTIMIZATION";
const EC2_RECOMMENDATION_CATEGORY = "EC2";

type Ec2OptimizationAggregatedRow = {
  instanceId: string;
  instanceName: string | null;
  instanceType: string | null;
  cloudConnectionId: string | null;
  billingSourceId: number | string | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
  regionKey: number | string | null;
  subAccountKey: number | string | null;
  availabilityZone: string | null;
  state: string | null;
  isRunning: boolean | null;
  reservationType: string | null;
  avgCpu: number | string | null;
  peakCpu: number | string | null;
  avgDailyNetworkBytes: number | string | null;
  runningHours: number | string | null;
  runningDayCount: number | string | null;
  computeCost: number | string | null;
  totalEffectiveCost: number | string | null;
  totalBilledCost: number | string | null;
  hasReservedOrSavingsPlanCoverage: boolean | null;
};

type EbsWasteRow = {
  volumeId: string;
  volumeType: string | null;
  cloudConnectionId: string | null;
  billingSourceId: number | string | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
  regionKey: number | string | null;
  subAccountKey: number | string | null;
  totalCost: number | string | null;
  isUnattached: boolean | null;
  isAttachedToStoppedInstance: boolean | null;
};

type PersistedInstanceRecommendationRow = {
  cloudConnectionId: string | null;
  billingSourceId: number | string | null;
  resourceId: string;
  recommendationType: string;
  estimatedMonthlySavings: number | string | null;
  recommendationText: string | null;
  updatedAt: string | Date | null;
};

type ExistingOpenRecommendation = {
  id: string | number;
  tenantId: string;
  cloudConnectionId: string | null;
  billingSourceId: string | number | null;
  resourceId: string | null;
  recommendationType: string;
  observationStart: Date | null;
  observationEnd: Date | null;
};

type PersistedRecommendationListRow = {
  recommendationId: number | string;
  recommendationType: string | null;
  resourceType: string | null;
  resourceId: string | null;
  resourceName: string | null;
  accountName: string | null;
  awsAccountId: string | null;
  region: string | null;
  availabilityZone: string | null;
  currentResourceType: string | null;
  recommendedResourceType: string | null;
  monthlyCost: number | string | null;
  estimatedSavings: number | string | null;
  projectedMonthlyCost: number | string | null;
  riskLevel: string | null;
  effortLevel: string | null;
  status: string | null;
  recommendationTitle: string | null;
  recommendationText: string | null;
  rawPayloadJson: string | null;
  updatedAt: string | Date | null;
};

const SUPPORTED_RECOMMENDATION_TYPES: Ec2OptimizationPersistedRecommendationType[] = [
  "idle_instance",
  "underutilized_instance",
  "overutilized_instance",
  "uncovered_on_demand",
  "unattached_ebs_volume",
  "ebs_attached_to_stopped_instance",
];

const SUPPORTED_INSTANCE_RECOMMENDATION_TYPES: Ec2OptimizationPersistedRecommendationType[] = [
  "idle_instance",
  "underutilized_instance",
  "overutilized_instance",
  "uncovered_on_demand",
];

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toNullableNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIntegerOrNull = (value: number | string | null | undefined): number | null => {
  if (value === null || typeof value === "undefined") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
};

const toNullableTrimmed = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

const normalizeReservationType = (
  value: string | null,
): "on_demand" | "reserved" | "savings_plan" | "spot" => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "reserved") return "reserved";
  if (normalized === "savings_plan") return "savings_plan";
  if (normalized === "spot") return "spot";
  return "on_demand";
};

const normalizeDateOnly = (value: Date | null): string => {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
};

const buildRecommendationBaseKey = (input: {
  tenantId: string;
  cloudConnectionId: string | null;
  billingSourceId: string | number | null;
  resourceId: string | null;
  recommendationType: string | null;
}): string =>
  [
    input.tenantId,
    input.cloudConnectionId ?? "",
    input.billingSourceId ?? "",
    input.resourceId ?? "",
    input.recommendationType ?? "",
  ].join("|");

const buildRecommendationExactKey = (input: {
  tenantId: string;
  cloudConnectionId: string | null;
  billingSourceId: string | number | null;
  resourceId: string | null;
  recommendationType: string | null;
  observationStart: Date | null;
  observationEnd: Date | null;
}): string =>
  [
    buildRecommendationBaseKey(input),
    normalizeDateOnly(input.observationStart),
    normalizeDateOnly(input.observationEnd),
  ].join("|");

const toRecommendationDate = (dateValue: Date): Date => new Date(`${dateValue.toISOString().slice(0, 10)}T00:00:00.000Z`);

const isSupportedPersistedRecommendationType = (
  value: string | null | undefined,
): value is Ec2OptimizationPersistedRecommendationType =>
  Boolean(value && SUPPORTED_RECOMMENDATION_TYPES.includes(value as Ec2OptimizationPersistedRecommendationType));

const recommendationPriority = (value: Ec2OptimizationPersistedRecommendationType): number => {
  if (value === "idle_instance") return 1;
  if (value === "underutilized_instance") return 2;
  if (value === "overutilized_instance") return 3;
  if (value === "uncovered_on_demand") return 4;
  if (value === "unattached_ebs_volume") return 5;
  return 6;
};

const buildInstanceRecommendationScopeWhere = (input: {
  tenantId: string;
  cloudConnectionId: string | null;
  billingSourceId: number | null;
}) => ({
  tenantId: input.tenantId,
  sourceSystem: EC2_RECOMMENDATION_SOURCE_SYSTEM,
  category: EC2_RECOMMENDATION_CATEGORY,
  status: "OPEN",
  ...(input.cloudConnectionId ? { cloudConnectionId: input.cloudConnectionId } : {}),
  ...(input.billingSourceId !== null ? { billingSourceId: String(input.billingSourceId) } : {}),
});

export class Ec2OptimizationRepository {
  async getPersistedRecommendations(
    input: Ec2OptimizationRecommendationsQuery,
  ): Promise<PersistedRecommendationListRow[]> {
    const status = input.status?.trim().toUpperCase() ?? null;

    const rows = await sequelize.query<PersistedRecommendationListRow>(
      `
        SELECT
          fr.id AS "recommendationId",
          fr.recommendation_type::text AS "recommendationType",
          fr.resource_type::text AS "resourceType",
          fr.resource_id::text AS "resourceId",
          fr.resource_name::text AS "resourceName",
          COALESCE(dsa.sub_account_name, fr.aws_account_id)::text AS "accountName",
          fr.aws_account_id::text AS "awsAccountId",
          COALESCE(fr.aws_region_code, dr.region_id, dr.region_name)::text AS region,
          dr.availability_zone::text AS "availabilityZone",
          fr.current_resource_type::text AS "currentResourceType",
          fr.recommended_resource_type::text AS "recommendedResourceType",
          fr.current_monthly_cost AS "monthlyCost",
          fr.estimated_monthly_savings AS "estimatedSavings",
          fr.projected_monthly_cost AS "projectedMonthlyCost",
          LOWER(COALESCE(fr.risk_level, ''))::text AS "riskLevel",
          LOWER(COALESCE(fr.effort_level, ''))::text AS "effortLevel",
          fr.status::text AS status,
          fr.recommendation_title::text AS "recommendationTitle",
          fr.recommendation_text::text AS "recommendationText",
          fr.raw_payload_json::text AS "rawPayloadJson",
          fr.updated_at AS "updatedAt"
        FROM fact_recommendations fr
        LEFT JOIN dim_sub_account dsa
          ON dsa.id = fr.sub_account_key
        LEFT JOIN dim_region dr
          ON dr.id = fr.region_key
        WHERE fr.tenant_id = :tenantId
          AND fr.category = :category
          AND (:cloudConnectionId::uuid IS NULL OR fr.cloud_connection_id = :cloudConnectionId::uuid)
          AND (:billingSourceId::bigint IS NULL OR fr.billing_source_id = :billingSourceId::bigint)
          AND (:regionKey::bigint IS NULL OR fr.region_key = :regionKey::bigint)
          AND (:subAccountKey::bigint IS NULL OR fr.sub_account_key = :subAccountKey::bigint)
          AND (
            :dateFrom::date IS NULL
            OR :dateTo::date IS NULL
            OR fr.observation_start IS NULL
            OR fr.observation_end IS NULL
            OR (
              fr.observation_start::date <= :dateTo::date
              AND fr.observation_end::date >= :dateFrom::date
            )
          )
          AND (
            :region::text IS NULL
            OR COALESCE(fr.aws_region_code, dr.region_id, dr.region_name, '') ILIKE ('%' || :region::text || '%')
          )
          AND (
            :riskLevel::text IS NULL
            OR LOWER(COALESCE(fr.risk_level, '')) = :riskLevel::text
          )
          AND (
            :status::text IS NULL
            OR UPPER(COALESCE(fr.status, '')) = :status::text
          )
        ORDER BY
          fr.estimated_monthly_savings DESC NULLS LAST,
          fr.current_monthly_cost DESC NULLS LAST,
          fr.updated_at DESC NULLS LAST;
      `,
      {
        replacements: {
          tenantId: input.tenantId,
          category: EC2_RECOMMENDATION_CATEGORY,
          cloudConnectionId: input.cloudConnectionId,
          billingSourceId: input.billingSourceId,
          regionKey: input.regionKey,
          subAccountKey: input.subAccountKey,
          dateFrom: input.dateFrom ?? null,
          dateTo: input.dateTo ?? null,
          region: input.region,
          riskLevel: input.riskLevel,
          status,
        },
        type: QueryTypes.SELECT,
      },
    );

    return rows;
  }

  async getAggregatedInstances(input: Ec2OptimizationSummaryQuery): Promise<Ec2OptimizationAggregatedInstance[]> {
    const rows = await sequelize.query<Ec2OptimizationAggregatedRow>(
      `
        WITH scoped AS (
          SELECT
            fed.usage_date,
            fed.instance_id,
            fed.cloud_connection_id,
            fed.billing_source_id,
            fed.region_key,
            fed.sub_account_key,
            fed.instance_name,
            fed.instance_type,
            fed.availability_zone,
            fed.state,
            fed.is_running,
            fed.cpu_avg,
            fed.cpu_max,
            fed.network_in_bytes,
            fed.network_out_bytes,
            fed.total_hours,
            fed.compute_cost,
            fed.total_effective_cost,
            fed.total_billed_cost,
            LOWER(
              COALESCE(
                NULLIF(TRIM(fed.reservation_type), ''),
                NULLIF(TRIM(fed.pricing_model), ''),
                CASE WHEN COALESCE(fed.is_spot, FALSE) THEN 'spot' ELSE 'on_demand' END
              )
            ) AS resolved_reservation_type
          FROM fact_ec2_instance_daily fed
          WHERE fed.tenant_id = :tenantId
            AND fed.usage_date >= :dateFrom::date
            AND fed.usage_date < (:dateTo::date + INTERVAL '1 day')
            AND (:cloudConnectionId::uuid IS NULL OR fed.cloud_connection_id = :cloudConnectionId::uuid)
            AND (:billingSourceId::bigint IS NULL OR fed.billing_source_id = :billingSourceId::bigint)
            AND (:regionKey::bigint IS NULL OR fed.region_key = :regionKey::bigint)
            AND (:subAccountKey::bigint IS NULL OR fed.sub_account_key = :subAccountKey::bigint)
            AND (:instanceType::text IS NULL OR fed.instance_type = :instanceType::text)
            AND (
              :search::text IS NULL
              OR fed.instance_id ILIKE ('%' || :search::text || '%')
              OR COALESCE(fed.instance_name, '') ILIKE ('%' || :search::text || '%')
            )
        ),
        grouped AS (
          SELECT
            s.cloud_connection_id,
            s.billing_source_id,
            s.instance_id,
            SUM(COALESCE(s.total_hours, 0))::double precision AS running_hours,
            COUNT(DISTINCT CASE WHEN COALESCE(s.total_hours, 0) > 0 THEN s.usage_date END)::int AS running_day_count,
            AVG(s.cpu_avg::double precision) FILTER (WHERE s.cpu_avg IS NOT NULL) AS avg_cpu,
            MAX(s.cpu_max::double precision) FILTER (WHERE s.cpu_max IS NOT NULL) AS peak_cpu,
            AVG((COALESCE(s.network_in_bytes, 0) + COALESCE(s.network_out_bytes, 0))::double precision) AS avg_daily_network_bytes,
            SUM(COALESCE(s.compute_cost, 0))::double precision AS compute_cost,
            SUM(COALESCE(s.total_effective_cost, 0))::double precision AS total_effective_cost,
            SUM(COALESCE(s.total_billed_cost, 0))::double precision AS total_billed_cost,
            BOOL_OR(s.resolved_reservation_type IN ('reserved', 'savings_plan')) AS has_reserved_or_savings_plan_coverage
          FROM scoped s
          GROUP BY
            s.cloud_connection_id,
            s.billing_source_id,
            s.instance_id
        ),
        latest_attrs AS (
          SELECT DISTINCT ON (s.cloud_connection_id, s.billing_source_id, s.instance_id)
            s.cloud_connection_id,
            s.billing_source_id,
            s.instance_id,
            COALESCE(NULLIF(TRIM(COALESCE(s.instance_name, '')), ''), s.instance_id) AS instance_name,
            NULLIF(TRIM(COALESCE(s.instance_type, '')), '') AS instance_type,
            s.region_key,
            s.sub_account_key,
            NULLIF(TRIM(COALESCE(s.availability_zone, '')), '') AS availability_zone,
            NULLIF(TRIM(COALESCE(s.state, '')), '') AS state,
            COALESCE(s.is_running, FALSE) AS is_running,
            s.resolved_reservation_type
          FROM scoped s
          ORDER BY
            s.cloud_connection_id,
            s.billing_source_id,
            s.instance_id,
            s.usage_date DESC
        )
        SELECT
          g.instance_id::text AS "instanceId",
          la.instance_name::text AS "instanceName",
          la.instance_type::text AS "instanceType",
          g.cloud_connection_id::text AS "cloudConnectionId",
          g.billing_source_id AS "billingSourceId",
          dsa.sub_account_id::text AS "awsAccountId",
          COALESCE(dr.region_id, dr.region_name)::text AS "awsRegionCode",
          la.region_key AS "regionKey",
          la.sub_account_key AS "subAccountKey",
          la.availability_zone::text AS "availabilityZone",
          la.state::text AS state,
          la.is_running AS "isRunning",
          la.resolved_reservation_type::text AS "reservationType",
          g.avg_cpu AS "avgCpu",
          g.peak_cpu AS "peakCpu",
          g.avg_daily_network_bytes AS "avgDailyNetworkBytes",
          g.running_hours AS "runningHours",
          g.running_day_count AS "runningDayCount",
          g.compute_cost AS "computeCost",
          g.total_effective_cost AS "totalEffectiveCost",
          g.total_billed_cost AS "totalBilledCost",
          g.has_reserved_or_savings_plan_coverage AS "hasReservedOrSavingsPlanCoverage"
        FROM grouped g
        INNER JOIN latest_attrs la
          ON la.cloud_connection_id IS NOT DISTINCT FROM g.cloud_connection_id
          AND la.billing_source_id IS NOT DISTINCT FROM g.billing_source_id
          AND la.instance_id = g.instance_id
        LEFT JOIN dim_sub_account dsa
          ON dsa.id = la.sub_account_key
        LEFT JOIN dim_region dr
          ON dr.id = la.region_key
        WHERE (
          :reservationType::text IS NULL
          OR la.resolved_reservation_type = :reservationType::text
        );
      `,
      {
        replacements: input,
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => ({
      instanceId: row.instanceId,
      instanceName: row.instanceName?.trim() || row.instanceId,
      instanceType: toNullableTrimmed(row.instanceType),
      cloudConnectionId: toNullableTrimmed(row.cloudConnectionId),
      billingSourceId: toIntegerOrNull(row.billingSourceId),
      awsAccountId: toNullableTrimmed(row.awsAccountId),
      awsRegionCode: toNullableTrimmed(row.awsRegionCode),
      regionKey: toIntegerOrNull(row.regionKey),
      subAccountKey: toIntegerOrNull(row.subAccountKey),
      availabilityZone: toNullableTrimmed(row.availabilityZone),
      state: toNullableTrimmed(row.state),
      isRunning: Boolean(row.isRunning),
      reservationType: normalizeReservationType(row.reservationType),
      avgCpu: toNullableNumber(row.avgCpu),
      peakCpu: toNullableNumber(row.peakCpu),
      avgDailyNetworkBytes: toNumber(row.avgDailyNetworkBytes),
      runningHours: toNumber(row.runningHours),
      runningDayCount: Math.trunc(toNumber(row.runningDayCount)),
      computeCost: toNumber(row.computeCost),
      totalEffectiveCost: toNumber(row.totalEffectiveCost),
      totalBilledCost: toNumber(row.totalBilledCost),
      hasReservedOrSavingsPlanCoverage: Boolean(row.hasReservedOrSavingsPlanCoverage),
    }));
  }

  async getEbsWasteCandidates(input: Ec2OptimizationSummaryQuery): Promise<Ec2OptimizationEbsWasteCandidate[]> {
    const rows = await sequelize.query<EbsWasteRow>(
      `
        WITH scoped AS (
          SELECT
            fvd.usage_date,
            fvd.volume_id,
            fvd.volume_type,
            fvd.cloud_connection_id,
            fvd.billing_source_id,
            fvd.sub_account_key,
            fvd.region_key,
            fvd.total_cost,
            fvd.is_unattached,
            fvd.is_attached_to_stopped_instance
          FROM fact_ebs_volume_daily fvd
          WHERE fvd.tenant_id = :tenantId
            AND fvd.usage_date >= :dateFrom::date
            AND fvd.usage_date < (:dateTo::date + INTERVAL '1 day')
            AND (:cloudConnectionId::uuid IS NULL OR fvd.cloud_connection_id = :cloudConnectionId::uuid)
            AND (:billingSourceId::bigint IS NULL OR fvd.billing_source_id = :billingSourceId::bigint)
            AND (:regionKey::bigint IS NULL OR fvd.region_key = :regionKey::bigint)
            AND (:subAccountKey::bigint IS NULL OR fvd.sub_account_key = :subAccountKey::bigint)
            AND (
              :search::text IS NULL
              OR fvd.volume_id ILIKE ('%' || :search::text || '%')
            )
        ),
        grouped AS (
          SELECT
            s.cloud_connection_id,
            s.billing_source_id,
            s.volume_id,
            SUM(COALESCE(s.total_cost, 0))::double precision AS total_cost,
            BOOL_OR(COALESCE(s.is_unattached, FALSE)) AS is_unattached,
            BOOL_OR(COALESCE(s.is_attached_to_stopped_instance, FALSE)) AS is_attached_to_stopped_instance
          FROM scoped s
          GROUP BY
            s.cloud_connection_id,
            s.billing_source_id,
            s.volume_id
        ),
        latest_attrs AS (
          SELECT DISTINCT ON (s.cloud_connection_id, s.billing_source_id, s.volume_id)
            s.cloud_connection_id,
            s.billing_source_id,
            s.volume_id,
            NULLIF(TRIM(COALESCE(s.volume_type, '')), '') AS volume_type,
            s.sub_account_key,
            s.region_key
          FROM scoped s
          ORDER BY
            s.cloud_connection_id,
            s.billing_source_id,
            s.volume_id,
            s.usage_date DESC
        )
        SELECT
          g.volume_id::text AS "volumeId",
          la.volume_type::text AS "volumeType",
          g.cloud_connection_id::text AS "cloudConnectionId",
          g.billing_source_id AS "billingSourceId",
          dsa.sub_account_id::text AS "awsAccountId",
          COALESCE(dr.region_id, dr.region_name)::text AS "awsRegionCode",
          la.region_key AS "regionKey",
          la.sub_account_key AS "subAccountKey",
          g.total_cost AS "totalCost",
          g.is_unattached AS "isUnattached",
          g.is_attached_to_stopped_instance AS "isAttachedToStoppedInstance"
        FROM grouped g
        INNER JOIN latest_attrs la
          ON la.cloud_connection_id IS NOT DISTINCT FROM g.cloud_connection_id
          AND la.billing_source_id IS NOT DISTINCT FROM g.billing_source_id
          AND la.volume_id = g.volume_id
        LEFT JOIN dim_sub_account dsa
          ON dsa.id = la.sub_account_key
        LEFT JOIN dim_region dr
          ON dr.id = la.region_key
        WHERE g.is_unattached = TRUE
          OR g.is_attached_to_stopped_instance = TRUE;
      `,
      {
        replacements: input,
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => ({
      volumeId: row.volumeId,
      volumeType: toNullableTrimmed(row.volumeType),
      cloudConnectionId: toNullableTrimmed(row.cloudConnectionId),
      billingSourceId: toIntegerOrNull(row.billingSourceId),
      awsAccountId: toNullableTrimmed(row.awsAccountId),
      awsRegionCode: toNullableTrimmed(row.awsRegionCode),
      regionKey: toIntegerOrNull(row.regionKey),
      subAccountKey: toIntegerOrNull(row.subAccountKey),
      totalCost: toNumber(row.totalCost),
      isUnattached: Boolean(row.isUnattached),
      isAttachedToStoppedInstance: Boolean(row.isAttachedToStoppedInstance),
    }));
  }

  async getOpenPersistedEc2InstanceRecommendations(input: {
    tenantId: string;
    cloudConnectionId: string | null;
    billingSourceId: number | null;
    instanceIds: string[];
  }): Promise<PersistedEc2InstanceRecommendation[]> {
    const dedupedInstanceIds = Array.from(
      new Set(input.instanceIds.map((item) => item.trim()).filter((item) => item.length > 0)),
    );
    if (dedupedInstanceIds.length === 0) return [];

    const rows = await sequelize.query<PersistedInstanceRecommendationRow>(
      `
        SELECT
          fr.cloud_connection_id::text AS "cloudConnectionId",
          fr.billing_source_id AS "billingSourceId",
          fr.resource_id::text AS "resourceId",
          fr.recommendation_type::text AS "recommendationType",
          fr.estimated_monthly_savings AS "estimatedMonthlySavings",
          fr.recommendation_text AS "recommendationText",
          fr.updated_at AS "updatedAt"
        FROM fact_recommendations fr
        WHERE fr.tenant_id = :tenantId
          AND fr.source_system = :sourceSystem
          AND fr.category = :category
          AND fr.status = 'OPEN'
          AND fr.resource_type = 'ec2_instance'
          AND fr.resource_id IN (:resourceIds)
          AND fr.recommendation_type IN (:recommendationTypes)
          AND (:cloudConnectionId::uuid IS NULL OR fr.cloud_connection_id = :cloudConnectionId::uuid)
          AND (:billingSourceId::bigint IS NULL OR fr.billing_source_id = :billingSourceId::bigint);
      `,
      {
        replacements: {
          tenantId: input.tenantId,
          cloudConnectionId: input.cloudConnectionId,
          billingSourceId: input.billingSourceId,
          sourceSystem: EC2_RECOMMENDATION_SOURCE_SYSTEM,
          category: EC2_RECOMMENDATION_CATEGORY,
          recommendationTypes: SUPPORTED_INSTANCE_RECOMMENDATION_TYPES,
          resourceIds: dedupedInstanceIds,
        },
        type: QueryTypes.SELECT,
      },
    );

    const groupedByResource = new Map<string, PersistedEc2InstanceRecommendation[]>();
    for (const row of rows) {
      if (!isSupportedPersistedRecommendationType(row.recommendationType)) continue;
      const resourceId = row.resourceId?.trim();
      if (!resourceId) continue;

      const normalized: PersistedEc2InstanceRecommendation = {
        cloudConnectionId: toNullableTrimmed(row.cloudConnectionId),
        billingSourceId: toIntegerOrNull(row.billingSourceId),
        resourceId,
        recommendationType: row.recommendationType,
        estimatedMonthlySavings: toNumber(row.estimatedMonthlySavings),
        recommendationText: toNullableTrimmed(row.recommendationText),
        updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
      };

      const existing = groupedByResource.get(resourceId) ?? [];
      existing.push(normalized);
      groupedByResource.set(resourceId, existing);
    }

    const result: PersistedEc2InstanceRecommendation[] = [];
    groupedByResource.forEach((recommendations) => {
      const sorted = [...recommendations].sort((left, right) => {
        const priorityDiff =
          recommendationPriority(left.recommendationType) - recommendationPriority(right.recommendationType);
        if (priorityDiff !== 0) return priorityDiff;
        const leftUpdated = left.updatedAt?.getTime() ?? 0;
        const rightUpdated = right.updatedAt?.getTime() ?? 0;
        return rightUpdated - leftUpdated;
      });
      if (sorted[0]) result.push(sorted[0]);
    });

    return result;
  }

  async persistEc2Recommendations(
    input: PersistEc2RecommendationsInput,
  ): Promise<PersistEc2RecommendationsResult> {
    const scopedWhere = buildInstanceRecommendationScopeWhere({
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      billingSourceId: input.billingSourceId,
    });

    const now = new Date();
    const observationStart = toRecommendationDate(input.observationStart);
    const observationEnd = toRecommendationDate(input.observationEnd);

    return sequelize.transaction(async (transaction) => {
      const existingOpenRowsRaw = await FactRecommendations.findAll({
        attributes: [
          "id",
          "tenantId",
          "cloudConnectionId",
          "billingSourceId",
          "resourceId",
          "recommendationType",
          "observationStart",
          "observationEnd",
        ],
        where: {
          ...scopedWhere,
          recommendationType: SUPPORTED_RECOMMENDATION_TYPES,
        },
        transaction,
      });

      const existingOpenRows: ExistingOpenRecommendation[] = existingOpenRowsRaw.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        cloudConnectionId: row.cloudConnectionId,
        billingSourceId: row.billingSourceId,
        resourceId: row.resourceId,
        recommendationType: row.recommendationType,
        observationStart: row.observationStart,
        observationEnd: row.observationEnd,
      }));

      const existingByExactKey = new Map<string, ExistingOpenRecommendation>();
      const existingByBaseKey = new Map<string, ExistingOpenRecommendation>();
      for (const row of existingOpenRows) {
        const exactKey = buildRecommendationExactKey({
          tenantId: row.tenantId,
          cloudConnectionId: row.cloudConnectionId,
          billingSourceId: row.billingSourceId,
          resourceId: row.resourceId,
          recommendationType: row.recommendationType,
          observationStart: row.observationStart,
          observationEnd: row.observationEnd,
        });
        existingByExactKey.set(exactKey, row);

        const baseKey = buildRecommendationBaseKey({
          tenantId: row.tenantId,
          cloudConnectionId: row.cloudConnectionId,
          billingSourceId: row.billingSourceId,
          resourceId: row.resourceId,
          recommendationType: row.recommendationType,
        });
        if (!existingByBaseKey.has(baseKey)) {
          existingByBaseKey.set(baseKey, row);
        }
      }

      let created = 0;
      let updated = 0;

      const seenBaseKeys = new Set<string>();
      for (const recommendation of input.recommendations) {
        const baseKey = buildRecommendationBaseKey({
          tenantId: recommendation.tenantId,
          cloudConnectionId: recommendation.cloudConnectionId,
          billingSourceId: recommendation.billingSourceId,
          resourceId: recommendation.resourceId,
          recommendationType: recommendation.recommendationType,
        });
        seenBaseKeys.add(baseKey);

        const exactKey = buildRecommendationExactKey({
          tenantId: recommendation.tenantId,
          cloudConnectionId: recommendation.cloudConnectionId,
          billingSourceId: recommendation.billingSourceId,
          resourceId: recommendation.resourceId,
          recommendationType: recommendation.recommendationType,
          observationStart,
          observationEnd,
        });

        const matchedExisting = existingByExactKey.get(exactKey) ?? existingByBaseKey.get(baseKey) ?? null;

        const payload = {
          tenantId: recommendation.tenantId,
          cloudConnectionId: recommendation.cloudConnectionId,
          billingSourceId:
            recommendation.billingSourceId === null ? null : String(recommendation.billingSourceId),
          awsAccountId: recommendation.awsAccountId,
          awsRegionCode: recommendation.awsRegionCode,
          category: EC2_RECOMMENDATION_CATEGORY,
          recommendationType: recommendation.recommendationType,
          serviceKey: null,
          subAccountKey: recommendation.subAccountKey,
          regionKey: recommendation.regionKey,
          resourceId: recommendation.resourceId,
          resourceArn: null,
          resourceName: recommendation.resourceName,
          resourceType: recommendation.resourceType,
          currentResourceType: recommendation.currentResourceType,
          recommendedResourceType: recommendation.recommendedResourceType,
          currentMonthlyCost: recommendation.currentMonthlyCost,
          estimatedMonthlySavings: recommendation.estimatedMonthlySavings,
          projectedMonthlyCost: recommendation.projectedMonthlyCost,
          recommendedHourlyCommitment: 0,
          recommendedPaymentOption: null,
          recommendedTerm: null,
          commitmentPlanType: null,
          performanceRiskScore: recommendation.performanceRiskScore,
          performanceRiskLevel: recommendation.performanceRiskLevel,
          sourceSystem: EC2_RECOMMENDATION_SOURCE_SYSTEM,
          status: "OPEN",
          effortLevel: recommendation.effortLevel,
          riskLevel: recommendation.riskLevel,
          recommendationTitle: recommendation.recommendationTitle,
          recommendationText: recommendation.recommendationText,
          idleReason: null,
          idleObservationValue: null,
          observationStart,
          observationEnd,
          rawPayloadJson: recommendation.rawPayloadJson,
          updatedAt: now,
        };

        if (matchedExisting) {
          await FactRecommendations.update(payload, {
            where: { id: matchedExisting.id },
            transaction,
          });
          updated += 1;
          continue;
        }

        await FactRecommendations.create({
          ...payload,
          createdAt: now,
        }, {
          transaction,
        });
        created += 1;
      }

      let resolved = 0;
      if (input.resolveStaleOpen) {
        for (const existing of existingOpenRows) {
          const baseKey = buildRecommendationBaseKey({
            tenantId: existing.tenantId,
            cloudConnectionId: existing.cloudConnectionId,
            billingSourceId: existing.billingSourceId,
            resourceId: existing.resourceId,
            recommendationType: existing.recommendationType,
          });
          if (seenBaseKeys.has(baseKey)) continue;

          await FactRecommendations.update(
            {
              status: "RESOLVED",
              updatedAt: now,
            },
            {
              where: { id: existing.id },
              transaction,
            },
          );
          resolved += 1;
        }
      }

      return { created, updated, resolved };
    });
  }
}
