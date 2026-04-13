import { QueryTypes } from "sequelize";
import env from "../../../config/env.js";
import { ConflictError, NotFoundError } from "../../../errors/http-errors.js";
import { sequelize } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import type { DashboardSectionResponse } from "../overview/overview.service.js";
import {
  syncAwsCommitmentRecommendations,
  syncAwsCommitmentRecommendationsWithFreshness,
  syncAwsIdleRecommendations,
  syncAwsRightsizingRecommendations,
} from "./recommendation-sync/sync.service.js";
import {
  executeRightsizingAction,
  getRightsizingActionStatus,
  type RightsizingActionExecuteResult,
  type RightsizingActionStatusResult,
  processQueuedRightsizingActions,
} from "./recommendation-sync/rightsizing-actions.service.js";
import {
  executeIdleAction,
  getIdleActionStatus,
  type IdleActionExecuteResult,
  type IdleActionStatusResult,
  processQueuedIdleActions,
} from "./recommendation-sync/idle-actions.service.js";
import type {
  AwsCommitmentRecommendationInput,
  AwsComputeOptimizerEc2RecommendationInput,
  OptimizationSyncResult,
} from "./recommendation-sync/types.js";

type OptimizationSummaryRow = {
  open_recommendations: number | string | null;
  potential_savings: number | string | null;
  implemented_this_month: number | string | null;
};

type RightsizingOverviewRow = {
  total_savings: number | string | null;
  open_recommendations: number | string | null;
  quick_wins_count: number | string | null;
  high_priority_count: number | string | null;
  low_risk_count: number | string | null;
  medium_risk_count: number | string | null;
  high_risk_count: number | string | null;
};

type IdleOverviewRow = {
  total_savings: number | string | null;
  open_recommendations: number | string | null;
  high_impact_count: number | string | null;
  low_risk_count: number | string | null;
};

type CommitmentOverviewRow = {
  total_savings: number | string | null;
  open_recommendations: number | string | null;
  hourly_commitment_total: number | string | null;
  one_year_count: number | string | null;
  three_year_count: number | string | null;
};

type RecommendationListRow = {
  id: number | string;
  recommendation: string | null;
  resource_id: string;
  resource_name: string | null;
  current_type: string | null;
  recommended_type: string | null;
  current_cost: number | string | null;
  estimated_savings: number | string | null;
  risk: string | null;
  effort: string | null;
  status: string;
  aws_account_id: string;
  aws_region_code: string;
  service_name: string | null;
  total_count: number | string | null;
};

type IdleRecommendationListRow = {
  id: number | string;
  recommendation_type: string;
  recommendation: string | null;
  resource_id: string;
  resource_name: string | null;
  resource_type: string | null;
  idle_reason: string | null;
  idle_observation_value: string | null;
  current_cost: number | string | null;
  estimated_savings: number | string | null;
  status: string;
  aws_account_id: string;
  aws_region_code: string;
  service_name: string | null;
  observation_end: string | null;
  total_count: number | string | null;
};

type RecommendationDetailRow = {
  id: number | string;
  recommendation_type: string;
  category: string;
  resource_id: string;
  resource_name: string | null;
  resource_arn: string | null;
  aws_account_id: string;
  aws_region_code: string;
  service_name: string | null;
  current_resource_type: string | null;
  recommended_resource_type: string | null;
  current_monthly_cost: number | string | null;
  estimated_monthly_savings: number | string | null;
  projected_monthly_cost: number | string | null;
  performance_risk_level: string | null;
  performance_risk_score: number | string | null;
  effort_level: string | null;
  risk_level: string | null;
  status: string;
  recommendation_title: string | null;
  recommendation_text: string | null;
  source_system: string;
  observation_start: string | null;
  observation_end: string | null;
  raw_payload_json: string | null;
  created_at: string;
  updated_at: string;
};

type IdleRecommendationDetailRow = {
  id: number | string;
  recommendation_type: string;
  category: string;
  resource_id: string;
  resource_name: string | null;
  resource_arn: string | null;
  resource_type: string | null;
  idle_reason: string | null;
  idle_observation_value: string | null;
  aws_account_id: string;
  aws_region_code: string;
  service_name: string | null;
  current_resource_type: string | null;
  current_monthly_cost: number | string | null;
  estimated_monthly_savings: number | string | null;
  projected_monthly_cost: number | string | null;
  effort_level: string | null;
  risk_level: string | null;
  status: string;
  recommendation_title: string | null;
  recommendation_text: string | null;
  source_system: string;
  observation_start: string | null;
  observation_end: string | null;
  raw_payload_json: string | null;
  created_at: string;
  updated_at: string;
};

type CommitmentRecommendationListRow = {
  id: number | string;
  recommendation_type: string;
  recommendation: string | null;
  resource_name: string | null;
  current_cost: number | string | null;
  estimated_savings: number | string | null;
  projected_cost: number | string | null;
  recommended_hourly_commitment: number | string | null;
  recommended_payment_option: string | null;
  recommended_term: string | null;
  commitment_plan_type: string | null;
  status: string;
  aws_account_id: string;
  aws_region_code: string | null;
  total_count: number | string | null;
};

type CommitmentRecommendationDetailRow = {
  id: number | string;
  recommendation_type: string;
  category: string;
  resource_id: string | null;
  resource_name: string | null;
  aws_account_id: string;
  aws_region_code: string | null;
  current_monthly_cost: number | string | null;
  estimated_monthly_savings: number | string | null;
  projected_monthly_cost: number | string | null;
  recommended_hourly_commitment: number | string | null;
  recommended_payment_option: string | null;
  recommended_term: string | null;
  commitment_plan_type: string | null;
  status: string;
  recommendation_title: string | null;
  recommendation_text: string | null;
  source_system: string;
  observation_start: string | null;
  observation_end: string | null;
  raw_payload_json: string | null;
  created_at: string;
  updated_at: string;
};

export type RightsizingOverviewResponse = {
  category: "RIGHTSIZING";
  totalPotentialSavings: number;
  openRecommendationCount: number;
  quickWinsCount: number;
  highPriorityCount: number;
  riskMix: {
    low: number;
    medium: number;
    high: number;
  };
};

export type IdleOverviewResponse = {
  category: "IDLE";
  totalPotentialSavings: number;
  openRecommendationCount: number;
  highImpactCount: number;
  lowRiskCount: number;
};

export type CommitmentOverviewResponse = {
  category: "COMMITMENT";
  totalPotentialSavings: number;
  openRecommendationCount: number;
  recommendedHourlyCommitmentTotal: number;
  oneYearCount: number;
  threeYearCount: number;
};

export type OptimizationRecommendationFilters = {
  status?: string[];
  effort?: string[];
  risk?: string[];
  accountIds?: string[];
  regions?: string[];
  serviceKeys?: number[];
  page: number;
  pageSize: number;
};

export type OptimizationRecommendationListItem = {
  id: string;
  recommendation: string;
  resource: string;
  currentType: string | null;
  recommendedType: string | null;
  currentCost: number;
  estimatedSavings: number;
  risk: string | null;
  effort: string | null;
  status: string;
  awsAccountId: string;
  awsRegionCode: string;
  serviceName: string | null;
};

export type OptimizationRecommendationsResponse = {
  items: OptimizationRecommendationListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type OptimizationRecommendationDetail = {
  id: string;
  recommendationType: string;
  category: string;
  resourceId: string;
  resourceName: string | null;
  resourceArn: string | null;
  awsAccountId: string;
  awsRegionCode: string;
  serviceName: string | null;
  currentResourceType: string | null;
  recommendedResourceType: string | null;
  currentMonthlyCost: number;
  estimatedMonthlySavings: number;
  projectedMonthlyCost: number;
  performanceRiskLevel: string | null;
  performanceRiskScore: number | null;
  effortLevel: string | null;
  riskLevel: string | null;
  status: string;
  recommendationTitle: string | null;
  recommendationText: string | null;
  sourceSystem: string;
  observationStart: string | null;
  observationEnd: string | null;
  rawPayloadJson: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IdleRecommendationListItem = {
  id: string;
  recommendationType: string;
  recommendation: string;
  resourceId: string;
  resourceName: string | null;
  resourceType: string | null;
  idleReason: string | null;
  idleObservationValue: string | null;
  currentMonthlyCost: number;
  estimatedMonthlySavings: number;
  status: string;
  awsAccountId: string;
  awsRegionCode: string;
  serviceName: string | null;
  lastObservedAt: string | null;
};

export type IdleRecommendationsResponse = {
  items: IdleRecommendationListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type IdleRecommendationDetail = {
  id: string;
  recommendationType: string;
  category: string;
  resourceId: string;
  resourceName: string | null;
  resourceArn: string | null;
  resourceType: string | null;
  idleReason: string | null;
  idleObservationValue: string | null;
  awsAccountId: string;
  awsRegionCode: string;
  serviceName: string | null;
  currentResourceType: string | null;
  currentMonthlyCost: number;
  estimatedMonthlySavings: number;
  projectedMonthlyCost: number;
  effortLevel: string | null;
  riskLevel: string | null;
  status: string;
  recommendationTitle: string | null;
  recommendationText: string | null;
  sourceSystem: string;
  observationStart: string | null;
  observationEnd: string | null;
  rawPayloadJson: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommitmentRecommendationListItem = {
  id: string;
  recommendationType: string;
  recommendation: string;
  resourceName: string | null;
  currentMonthlyCost: number;
  estimatedMonthlySavings: number;
  projectedMonthlyCost: number;
  recommendedHourlyCommitment: number;
  recommendedPaymentOption: string | null;
  recommendedTerm: string | null;
  commitmentPlanType: string | null;
  status: string;
  awsAccountId: string;
  awsRegionCode: string | null;
};

export type CommitmentRecommendationsResponse = {
  items: CommitmentRecommendationListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type CommitmentRecommendationDetail = {
  id: string;
  recommendationType: string;
  category: string;
  resourceId: string | null;
  resourceName: string | null;
  awsAccountId: string;
  awsRegionCode: string | null;
  currentMonthlyCost: number;
  estimatedMonthlySavings: number;
  projectedMonthlyCost: number;
  recommendedHourlyCommitment: number;
  recommendedPaymentOption: string | null;
  recommendedTerm: string | null;
  commitmentPlanType: string | null;
  status: string;
  recommendationTitle: string | null;
  recommendationText: string | null;
  sourceSystem: string;
  observationStart: string | null;
  observationEnd: string | null;
  rawPayloadJson: string | null;
  createdAt: string;
  updatedAt: string;
};

type RecommendationDebugStatsRow = {
  total_rows: number | string | null;
  open_rows: number | string | null;
  rightsizing_rows: number | string | null;
  rows_with_cloud_connection: number | string | null;
  rows_with_billing_source: number | string | null;
  distinct_accounts: number | string | null;
  latest_updated_at: string | null;
};

type RecommendationDebugSampleRow = {
  id: number | string;
  aws_account_id: string;
  aws_region_code: string;
  resource_id: string;
  status: string;
  estimated_monthly_savings: number | string | null;
  cloud_connection_id: string | null;
  billing_source_id: number | string | null;
  updated_at: string;
};

export type OptimizationRecommendationDebugData = {
  stats: {
    totalRows: number;
    openRows: number;
    rightsizingRows: number;
    rowsWithCloudConnection: number;
    rowsWithBillingSource: number;
    distinctAccounts: number;
    latestUpdatedAt: string | null;
  };
  sampleRows: Array<{
    id: string;
    awsAccountId: string;
    awsRegionCode: string;
    resourceId: string;
    status: string;
    estimatedMonthlySavings: number;
    cloudConnectionId: string | null;
    billingSourceId: string | null;
    updatedAt: string;
  }>;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toStringArray = (values?: string[]): string[] | null =>
  Array.isArray(values) && values.length > 0 ? values.map((value) => value.toUpperCase()) : null;

const RIGHTSIZING_PREDICATE_SQL = `
  (
    REGEXP_REPLACE(UPPER(COALESCE(fr.category, '')), '[^A-Z]', '', 'g') = 'RIGHTSIZING'
    OR REGEXP_REPLACE(UPPER(COALESCE(fr.recommendation_type, '')), '[^A-Z]', '', 'g') = 'RIGHTSIZING'
  )
`;

const IDLE_PREDICATE_SQL = `
  (
    REGEXP_REPLACE(UPPER(COALESCE(fr.category, '')), '[^A-Z]', '', 'g') = 'IDLE'
  )
`;

const COMMITMENT_PREDICATE_SQL = `
  (
    REGEXP_REPLACE(UPPER(COALESCE(fr.category, '')), '[^A-Z]', '', 'g') = 'COMMITMENT'
  )
`;

export async function getOptimizationDashboardData(tenantId: string): Promise<DashboardSectionResponse> {
  const rows = await sequelize.query<OptimizationSummaryRow>(
    `
      SELECT
        COALESCE(COUNT(*) FILTER (WHERE UPPER(fr.status) = 'OPEN'), 0)::bigint AS open_recommendations,
        COALESCE(SUM(fr.estimated_monthly_savings) FILTER (WHERE UPPER(fr.status) = 'OPEN'), 0)::double precision AS potential_savings,
        COALESCE(COUNT(*) FILTER (
          WHERE UPPER(fr.status) = 'APPLIED'
            AND fr.updated_at >= date_trunc('month', CURRENT_DATE)
        ), 0)::bigint AS implemented_this_month
      FROM fact_recommendations fr
      WHERE fr.tenant_id = $1;
    `,
    {
      bind: [tenantId],
      type: QueryTypes.SELECT,
    },
  );

  const summary = rows[0] ?? {
    open_recommendations: 0,
    potential_savings: 0,
    implemented_this_month: 0,
  };

  return {
    section: "optimization",
    title: "Optimization",
    message: "Optimization dashboard data fetched successfully",
    summary: [
      { label: "openRecommendations", value: String(toNumber(summary.open_recommendations)) },
      { label: "potentialSavings", value: String(toNumber(summary.potential_savings).toFixed(2)) },
      { label: "implementedThisMonth", value: String(toNumber(summary.implemented_this_month)) },
    ],
  };
}

export async function getRightsizingOverviewData(tenantId: string): Promise<RightsizingOverviewResponse> {
  const rows = await sequelize.query<RightsizingOverviewRow>(
    `
      SELECT
        COALESCE(SUM(fr.estimated_monthly_savings) FILTER (WHERE UPPER(fr.status) = 'OPEN'), 0)::double precision AS total_savings,
        COALESCE(COUNT(*) FILTER (WHERE UPPER(fr.status) = 'OPEN'), 0)::bigint AS open_recommendations,
        COALESCE(COUNT(*) FILTER (
          WHERE UPPER(fr.status) = 'OPEN'
            AND (UPPER(COALESCE(fr.effort_level, 'LOW')) = 'LOW')
            AND UPPER(COALESCE(fr.risk_level, 'LOW')) IN ('LOW', 'MEDIUM')
        ), 0)::bigint AS quick_wins_count,
        COALESCE(COUNT(*) FILTER (
          WHERE UPPER(fr.status) = 'OPEN'
            AND UPPER(COALESCE(fr.risk_level, 'LOW')) = 'HIGH'
        ), 0)::bigint AS high_priority_count,
        COALESCE(COUNT(*) FILTER (
          WHERE UPPER(fr.status) = 'OPEN'
            AND UPPER(COALESCE(fr.risk_level, 'LOW')) = 'LOW'
        ), 0)::bigint AS low_risk_count,
        COALESCE(COUNT(*) FILTER (
          WHERE UPPER(fr.status) = 'OPEN'
            AND UPPER(COALESCE(fr.risk_level, 'LOW')) = 'MEDIUM'
        ), 0)::bigint AS medium_risk_count,
        COALESCE(COUNT(*) FILTER (
          WHERE UPPER(fr.status) = 'OPEN'
            AND UPPER(COALESCE(fr.risk_level, 'LOW')) = 'HIGH'
        ), 0)::bigint AS high_risk_count
      FROM fact_recommendations fr
      WHERE fr.tenant_id = $1
        AND ${RIGHTSIZING_PREDICATE_SQL};
    `,
    {
      bind: [tenantId],
      type: QueryTypes.SELECT,
    },
  );

  const first = rows[0];
  return {
    category: "RIGHTSIZING",
    totalPotentialSavings: toNumber(first?.total_savings),
    openRecommendationCount: toNumber(first?.open_recommendations),
    quickWinsCount: toNumber(first?.quick_wins_count),
    highPriorityCount: toNumber(first?.high_priority_count),
    riskMix: {
      low: toNumber(first?.low_risk_count),
      medium: toNumber(first?.medium_risk_count),
      high: toNumber(first?.high_risk_count),
    },
  };
}

export async function getIdleOverviewData(tenantId: string): Promise<IdleOverviewResponse> {
  const rows = await sequelize.query<IdleOverviewRow>(
    `
      SELECT
        COALESCE(SUM(fr.estimated_monthly_savings) FILTER (WHERE UPPER(fr.status) = 'OPEN'), 0)::double precision AS total_savings,
        COALESCE(COUNT(*) FILTER (WHERE UPPER(fr.status) = 'OPEN'), 0)::bigint AS open_recommendations,
        COALESCE(COUNT(*) FILTER (
          WHERE UPPER(fr.status) = 'OPEN'
            AND COALESCE(fr.estimated_monthly_savings, 0) > 0
        ), 0)::bigint AS high_impact_count,
        COALESCE(COUNT(*) FILTER (
          WHERE UPPER(fr.status) = 'OPEN'
            AND UPPER(COALESCE(fr.risk_level, 'LOW')) = 'LOW'
        ), 0)::bigint AS low_risk_count
      FROM fact_recommendations fr
      WHERE fr.tenant_id = $1
        AND ${IDLE_PREDICATE_SQL};
    `,
    {
      bind: [tenantId],
      type: QueryTypes.SELECT,
    },
  );

  const first = rows[0];
  return {
    category: "IDLE",
    totalPotentialSavings: toNumber(first?.total_savings),
    openRecommendationCount: toNumber(first?.open_recommendations),
    highImpactCount: toNumber(first?.high_impact_count),
    lowRiskCount: toNumber(first?.low_risk_count),
  };
}

export async function getCommitmentOverviewData(tenantId: string): Promise<CommitmentOverviewResponse> {
  const rows = await sequelize.query<CommitmentOverviewRow>(
    `
      SELECT
        COALESCE(SUM(fr.estimated_monthly_savings) FILTER (WHERE UPPER(fr.status) = 'OPEN'), 0)::double precision AS total_savings,
        COALESCE(COUNT(*) FILTER (WHERE UPPER(fr.status) = 'OPEN'), 0)::bigint AS open_recommendations,
        COALESCE(SUM(fr.recommended_hourly_commitment) FILTER (WHERE UPPER(fr.status) = 'OPEN'), 0)::double precision AS hourly_commitment_total,
        COALESCE(COUNT(*) FILTER (
          WHERE UPPER(fr.status) = 'OPEN'
            AND UPPER(COALESCE(fr.recommended_term, '')) = 'ONE_YEAR'
        ), 0)::bigint AS one_year_count,
        COALESCE(COUNT(*) FILTER (
          WHERE UPPER(fr.status) = 'OPEN'
            AND UPPER(COALESCE(fr.recommended_term, '')) = 'THREE_YEARS'
        ), 0)::bigint AS three_year_count
      FROM fact_recommendations fr
      WHERE fr.tenant_id = $1
        AND ${COMMITMENT_PREDICATE_SQL};
    `,
    {
      bind: [tenantId],
      type: QueryTypes.SELECT,
    },
  );

  const first = rows[0];
  return {
    category: "COMMITMENT",
    totalPotentialSavings: toNumber(first?.total_savings),
    openRecommendationCount: toNumber(first?.open_recommendations),
    recommendedHourlyCommitmentTotal: toNumber(first?.hourly_commitment_total),
    oneYearCount: toNumber(first?.one_year_count),
    threeYearCount: toNumber(first?.three_year_count),
  };
}

export async function getRightsizingRecommendationsData({
  tenantId,
  filters,
}: {
  tenantId: string;
  filters: OptimizationRecommendationFilters;
}): Promise<OptimizationRecommendationsResponse> {
  const conditions: string[] = [
    "fr.tenant_id = $1",
    RIGHTSIZING_PREDICATE_SQL,
  ];
  const bind: unknown[] = [tenantId];
  let next = 2;

  const pushTextArrayFilter = (column: string, values?: string[]) => {
    const normalized = toStringArray(values);
    if (!normalized) return;
    bind.push(normalized);
    conditions.push(`UPPER(${column}) = ANY($${next}::text[])`);
    next += 1;
  };

  if (Array.isArray(filters.accountIds) && filters.accountIds.length > 0) {
    bind.push(filters.accountIds);
    conditions.push(`fr.aws_account_id = ANY($${next}::text[])`);
    next += 1;
  }

  if (Array.isArray(filters.regions) && filters.regions.length > 0) {
    bind.push(filters.regions.map((region) => region.toLowerCase()));
    conditions.push(`LOWER(fr.aws_region_code) = ANY($${next}::text[])`);
    next += 1;
  }

  if (Array.isArray(filters.serviceKeys) && filters.serviceKeys.length > 0) {
    bind.push(filters.serviceKeys);
    conditions.push(`fr.service_key = ANY($${next}::bigint[])`);
    next += 1;
  }

  pushTextArrayFilter("fr.status", filters.status);
  pushTextArrayFilter("fr.effort_level", filters.effort);
  pushTextArrayFilter("fr.risk_level", filters.risk);

  const offset = (filters.page - 1) * filters.pageSize;
  bind.push(filters.pageSize);
  const limitIdx = next;
  bind.push(offset);
  const offsetIdx = next + 1;

  const whereClause = conditions.join("\n          AND ");

  const rows = await sequelize.query<RecommendationListRow>(
    `
      SELECT
        fr.id,
        COALESCE(fr.recommendation_title, fr.recommendation_type) AS recommendation,
        fr.resource_id,
        fr.resource_name,
        fr.current_resource_type AS current_type,
        fr.recommended_resource_type AS recommended_type,
        COALESCE(fr.current_monthly_cost, 0)::double precision AS current_cost,
        COALESCE(fr.estimated_monthly_savings, 0)::double precision AS estimated_savings,
        fr.risk_level AS risk,
        fr.effort_level AS effort,
        fr.status,
        fr.aws_account_id,
        fr.aws_region_code,
        ds.service_name,
        COUNT(*) OVER() AS total_count
      FROM fact_recommendations fr
      LEFT JOIN dim_service ds ON ds.id = fr.service_key
      WHERE ${whereClause}
      ORDER BY fr.estimated_monthly_savings DESC, fr.updated_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `,
    {
      bind,
      type: QueryTypes.SELECT,
    },
  );

  const total = toNumber(rows[0]?.total_count);
  return {
    items: rows.map((row) => ({
      id: String(row.id),
      recommendation: row.recommendation ?? "Rightsizing recommendation",
      resource: row.resource_name ? `${row.resource_id} / ${row.resource_name}` : row.resource_id,
      currentType: row.current_type,
      recommendedType: row.recommended_type,
      currentCost: toNumber(row.current_cost),
      estimatedSavings: toNumber(row.estimated_savings),
      risk: row.risk,
      effort: row.effort,
      status: row.status,
      awsAccountId: row.aws_account_id,
      awsRegionCode: row.aws_region_code,
      serviceName: row.service_name,
    })),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total > 0 ? Math.ceil(total / filters.pageSize) : 0,
    },
  };
}

export async function getRightsizingRecommendationDetailData({
  tenantId,
  recommendationId,
}: {
  tenantId: string;
  recommendationId: string;
}): Promise<OptimizationRecommendationDetail | null> {
  const rows = await sequelize.query<RecommendationDetailRow>(
    `
      SELECT
        fr.id,
        fr.recommendation_type,
        fr.category,
        fr.resource_id,
        fr.resource_name,
        fr.resource_arn,
        fr.aws_account_id,
        fr.aws_region_code,
        ds.service_name,
        fr.current_resource_type,
        fr.recommended_resource_type,
        fr.current_monthly_cost,
        fr.estimated_monthly_savings,
        fr.projected_monthly_cost,
        fr.performance_risk_level,
        fr.performance_risk_score,
        fr.effort_level,
        fr.risk_level,
        fr.status,
        fr.recommendation_title,
        fr.recommendation_text,
        fr.source_system,
        fr.observation_start::text AS observation_start,
        fr.observation_end::text AS observation_end,
        fr.raw_payload_json,
        fr.created_at::text AS created_at,
        fr.updated_at::text AS updated_at
      FROM fact_recommendations fr
      LEFT JOIN dim_service ds ON ds.id = fr.service_key
      WHERE fr.tenant_id = $1
        AND fr.id = $2
        AND ${RIGHTSIZING_PREDICATE_SQL}
      LIMIT 1;
    `,
    {
      bind: [tenantId, recommendationId],
      type: QueryTypes.SELECT,
    },
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: String(row.id),
    recommendationType: row.recommendation_type,
    category: row.category,
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    resourceArn: row.resource_arn,
    awsAccountId: row.aws_account_id,
    awsRegionCode: row.aws_region_code,
    serviceName: row.service_name,
    currentResourceType: row.current_resource_type,
    recommendedResourceType: row.recommended_resource_type,
    currentMonthlyCost: toNumber(row.current_monthly_cost),
    estimatedMonthlySavings: toNumber(row.estimated_monthly_savings),
    projectedMonthlyCost: toNumber(row.projected_monthly_cost),
    performanceRiskLevel: row.performance_risk_level,
    performanceRiskScore:
      row.performance_risk_score === null ? null : toNumber(row.performance_risk_score),
    effortLevel: row.effort_level,
    riskLevel: row.risk_level,
    status: row.status,
    recommendationTitle: row.recommendation_title,
    recommendationText: row.recommendation_text,
    sourceSystem: row.source_system,
    observationStart: row.observation_start,
    observationEnd: row.observation_end,
    rawPayloadJson: row.raw_payload_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getIdleRecommendationsData({
  tenantId,
  filters,
}: {
  tenantId: string;
  filters: OptimizationRecommendationFilters;
}): Promise<IdleRecommendationsResponse> {
  const conditions: string[] = [
    "fr.tenant_id = $1",
    IDLE_PREDICATE_SQL,
  ];
  const bind: unknown[] = [tenantId];
  let next = 2;

  const pushTextArrayFilter = (column: string, values?: string[]) => {
    const normalized = toStringArray(values);
    if (!normalized) return;
    bind.push(normalized);
    conditions.push(`UPPER(${column}) = ANY($${next}::text[])`);
    next += 1;
  };

  if (Array.isArray(filters.accountIds) && filters.accountIds.length > 0) {
    bind.push(filters.accountIds);
    conditions.push(`fr.aws_account_id = ANY($${next}::text[])`);
    next += 1;
  }

  if (Array.isArray(filters.regions) && filters.regions.length > 0) {
    bind.push(filters.regions.map((region) => region.toLowerCase()));
    conditions.push(`LOWER(fr.aws_region_code) = ANY($${next}::text[])`);
    next += 1;
  }

  if (Array.isArray(filters.serviceKeys) && filters.serviceKeys.length > 0) {
    bind.push(filters.serviceKeys);
    conditions.push(`fr.service_key = ANY($${next}::bigint[])`);
    next += 1;
  }

  pushTextArrayFilter("fr.status", filters.status);
  pushTextArrayFilter("fr.effort_level", filters.effort);
  pushTextArrayFilter("fr.risk_level", filters.risk);

  const offset = (filters.page - 1) * filters.pageSize;
  bind.push(filters.pageSize);
  const limitIdx = next;
  bind.push(offset);
  const offsetIdx = next + 1;

  const whereClause = conditions.join("\n          AND ");

  const rows = await sequelize.query<IdleRecommendationListRow>(
    `
      SELECT
        fr.id,
        fr.recommendation_type,
        COALESCE(fr.recommendation_title, fr.recommendation_type) AS recommendation,
        fr.resource_id,
        fr.resource_name,
        fr.resource_type,
        fr.idle_reason,
        fr.idle_observation_value,
        COALESCE(fr.current_monthly_cost, 0)::double precision AS current_cost,
        COALESCE(fr.estimated_monthly_savings, 0)::double precision AS estimated_savings,
        fr.status,
        fr.aws_account_id,
        fr.aws_region_code,
        ds.service_name,
        fr.observation_end::text AS observation_end,
        COUNT(*) OVER() AS total_count
      FROM fact_recommendations fr
      LEFT JOIN dim_service ds ON ds.id = fr.service_key
      WHERE ${whereClause}
      ORDER BY fr.estimated_monthly_savings DESC, fr.updated_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `,
    {
      bind,
      type: QueryTypes.SELECT,
    },
  );

  const total = toNumber(rows[0]?.total_count);
  return {
    items: rows.map((row) => ({
      id: String(row.id),
      recommendationType: row.recommendation_type,
      recommendation: row.recommendation ?? "Idle resource recommendation",
      resourceId: row.resource_id,
      resourceName: row.resource_name,
      resourceType: row.resource_type,
      idleReason: row.idle_reason,
      idleObservationValue: row.idle_observation_value,
      currentMonthlyCost: toNumber(row.current_cost),
      estimatedMonthlySavings: toNumber(row.estimated_savings),
      status: row.status,
      awsAccountId: row.aws_account_id,
      awsRegionCode: row.aws_region_code,
      serviceName: row.service_name,
      lastObservedAt: row.observation_end,
    })),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total > 0 ? Math.ceil(total / filters.pageSize) : 0,
    },
  };
}

export async function getIdleRecommendationDetailData({
  tenantId,
  recommendationId,
}: {
  tenantId: string;
  recommendationId: string;
}): Promise<IdleRecommendationDetail | null> {
  const rows = await sequelize.query<IdleRecommendationDetailRow>(
    `
      SELECT
        fr.id,
        fr.recommendation_type,
        fr.category,
        fr.resource_id,
        fr.resource_name,
        fr.resource_arn,
        fr.resource_type,
        fr.idle_reason,
        fr.idle_observation_value,
        fr.aws_account_id,
        fr.aws_region_code,
        ds.service_name,
        fr.current_resource_type,
        fr.current_monthly_cost,
        fr.estimated_monthly_savings,
        fr.projected_monthly_cost,
        fr.effort_level,
        fr.risk_level,
        fr.status,
        fr.recommendation_title,
        fr.recommendation_text,
        fr.source_system,
        fr.observation_start::text AS observation_start,
        fr.observation_end::text AS observation_end,
        fr.raw_payload_json,
        fr.created_at::text AS created_at,
        fr.updated_at::text AS updated_at
      FROM fact_recommendations fr
      LEFT JOIN dim_service ds ON ds.id = fr.service_key
      WHERE fr.tenant_id = $1
        AND fr.id = $2
        AND ${IDLE_PREDICATE_SQL}
      LIMIT 1;
    `,
    {
      bind: [tenantId, recommendationId],
      type: QueryTypes.SELECT,
    },
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: String(row.id),
    recommendationType: row.recommendation_type,
    category: row.category,
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    resourceArn: row.resource_arn,
    resourceType: row.resource_type,
    idleReason: row.idle_reason,
    idleObservationValue: row.idle_observation_value,
    awsAccountId: row.aws_account_id,
    awsRegionCode: row.aws_region_code,
    serviceName: row.service_name,
    currentResourceType: row.current_resource_type,
    currentMonthlyCost: toNumber(row.current_monthly_cost),
    estimatedMonthlySavings: toNumber(row.estimated_monthly_savings),
    projectedMonthlyCost: toNumber(row.projected_monthly_cost),
    effortLevel: row.effort_level,
    riskLevel: row.risk_level,
    status: row.status,
    recommendationTitle: row.recommendation_title,
    recommendationText: row.recommendation_text,
    sourceSystem: row.source_system,
    observationStart: row.observation_start,
    observationEnd: row.observation_end,
    rawPayloadJson: row.raw_payload_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCommitmentRecommendationsData({
  tenantId,
  filters,
}: {
  tenantId: string;
  filters: OptimizationRecommendationFilters;
}): Promise<CommitmentRecommendationsResponse> {
  const conditions: string[] = [
    "fr.tenant_id = $1",
    COMMITMENT_PREDICATE_SQL,
  ];
  const bind: unknown[] = [tenantId];
  let next = 2;

  const pushTextArrayFilter = (column: string, values?: string[]) => {
    const normalized = toStringArray(values);
    if (!normalized) return;
    bind.push(normalized);
    conditions.push(`UPPER(${column}) = ANY($${next}::text[])`);
    next += 1;
  };

  if (Array.isArray(filters.accountIds) && filters.accountIds.length > 0) {
    bind.push(filters.accountIds);
    conditions.push(`fr.aws_account_id = ANY($${next}::text[])`);
    next += 1;
  }

  if (Array.isArray(filters.regions) && filters.regions.length > 0) {
    bind.push(filters.regions.map((region) => region.toLowerCase()));
    conditions.push(`LOWER(COALESCE(fr.aws_region_code, '')) = ANY($${next}::text[])`);
    next += 1;
  }

  pushTextArrayFilter("fr.status", filters.status);
  pushTextArrayFilter("fr.effort_level", filters.effort);
  pushTextArrayFilter("fr.risk_level", filters.risk);

  const offset = (filters.page - 1) * filters.pageSize;
  bind.push(filters.pageSize);
  const limitIdx = next;
  bind.push(offset);
  const offsetIdx = next + 1;
  const whereClause = conditions.join("\n          AND ");

  const rows = await sequelize.query<CommitmentRecommendationListRow>(
    `
      SELECT
        fr.id,
        fr.recommendation_type,
        COALESCE(fr.recommendation_title, fr.recommendation_type) AS recommendation,
        fr.resource_name,
        COALESCE(fr.current_monthly_cost, 0)::double precision AS current_cost,
        COALESCE(fr.estimated_monthly_savings, 0)::double precision AS estimated_savings,
        COALESCE(fr.projected_monthly_cost, 0)::double precision AS projected_cost,
        COALESCE(fr.recommended_hourly_commitment, 0)::double precision AS recommended_hourly_commitment,
        fr.recommended_payment_option,
        fr.recommended_term,
        fr.commitment_plan_type,
        fr.status,
        fr.aws_account_id,
        fr.aws_region_code,
        COUNT(*) OVER() AS total_count
      FROM fact_recommendations fr
      WHERE ${whereClause}
      ORDER BY fr.estimated_monthly_savings DESC, fr.updated_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `,
    {
      bind,
      type: QueryTypes.SELECT,
    },
  );

  const total = toNumber(rows[0]?.total_count);
  return {
    items: rows.map((row) => ({
      id: String(row.id),
      recommendationType: row.recommendation_type,
      recommendation: row.recommendation ?? "Commitment recommendation",
      resourceName: row.resource_name,
      currentMonthlyCost: toNumber(row.current_cost),
      estimatedMonthlySavings: toNumber(row.estimated_savings),
      projectedMonthlyCost: toNumber(row.projected_cost),
      recommendedHourlyCommitment: toNumber(row.recommended_hourly_commitment),
      recommendedPaymentOption: row.recommended_payment_option,
      recommendedTerm: row.recommended_term,
      commitmentPlanType: row.commitment_plan_type,
      status: row.status,
      awsAccountId: row.aws_account_id,
      awsRegionCode: row.aws_region_code,
    })),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total > 0 ? Math.ceil(total / filters.pageSize) : 0,
    },
  };
}

export async function getCommitmentRecommendationDetailData({
  tenantId,
  recommendationId,
}: {
  tenantId: string;
  recommendationId: string;
}): Promise<CommitmentRecommendationDetail | null> {
  const rows = await sequelize.query<CommitmentRecommendationDetailRow>(
    `
      SELECT
        fr.id,
        fr.recommendation_type,
        fr.category,
        fr.resource_id,
        fr.resource_name,
        fr.aws_account_id,
        fr.aws_region_code,
        fr.current_monthly_cost,
        fr.estimated_monthly_savings,
        fr.projected_monthly_cost,
        fr.recommended_hourly_commitment,
        fr.recommended_payment_option,
        fr.recommended_term,
        fr.commitment_plan_type,
        fr.status,
        fr.recommendation_title,
        fr.recommendation_text,
        fr.source_system,
        fr.observation_start::text AS observation_start,
        fr.observation_end::text AS observation_end,
        fr.raw_payload_json,
        fr.created_at::text AS created_at,
        fr.updated_at::text AS updated_at
      FROM fact_recommendations fr
      WHERE fr.tenant_id = $1
        AND fr.id = $2
        AND ${COMMITMENT_PREDICATE_SQL}
      LIMIT 1;
    `,
    {
      bind: [tenantId, recommendationId],
      type: QueryTypes.SELECT,
    },
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: String(row.id),
    recommendationType: row.recommendation_type,
    category: row.category,
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    awsAccountId: row.aws_account_id,
    awsRegionCode: row.aws_region_code,
    currentMonthlyCost: toNumber(row.current_monthly_cost),
    estimatedMonthlySavings: toNumber(row.estimated_monthly_savings),
    projectedMonthlyCost: toNumber(row.projected_monthly_cost),
    recommendedHourlyCommitment: toNumber(row.recommended_hourly_commitment),
    recommendedPaymentOption: row.recommended_payment_option,
    recommendedTerm: row.recommended_term,
    commitmentPlanType: row.commitment_plan_type,
    status: row.status,
    recommendationTitle: row.recommendation_title,
    recommendationText: row.recommendation_text,
    sourceSystem: row.source_system,
    observationStart: row.observation_start,
    observationEnd: row.observation_end,
    rawPayloadJson: row.raw_payload_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function triggerOptimizationRecommendationSync({
  tenantId,
  billingSourceId,
  cloudConnectionId,
  recommendations,
}: {
  tenantId: string;
  billingSourceId?: string | null;
  cloudConnectionId?: string | null;
  recommendations?: AwsComputeOptimizerEc2RecommendationInput[];
}): Promise<OptimizationSyncResult> {
  return syncAwsRightsizingRecommendations({
    tenantId,
    trigger: "MANUAL_API",
    billingSourceId,
    cloudConnectionId,
    recommendations,
  });
}

export async function triggerIdleRecommendationSync({
  tenantId,
  billingSourceId,
  cloudConnectionId,
}: {
  tenantId: string;
  billingSourceId?: string | null;
  cloudConnectionId?: string | null;
}): Promise<OptimizationSyncResult> {
  return syncAwsIdleRecommendations({
    tenantId,
    trigger: "MANUAL_API",
    billingSourceId,
    cloudConnectionId,
  });
}

export async function triggerCommitmentRecommendationSync({
  tenantId,
  billingSourceId,
  cloudConnectionId,
  recommendations,
  forceRefresh = false,
}: {
  tenantId: string;
  billingSourceId?: string | null;
  cloudConnectionId?: string | null;
  recommendations?: AwsCommitmentRecommendationInput[];
  forceRefresh?: boolean;
}): Promise<OptimizationSyncResult> {
  if (forceRefresh) {
    return syncAwsCommitmentRecommendations({
      tenantId,
      trigger: "MANUAL_API",
      billingSourceId,
      cloudConnectionId,
      recommendations,
    });
  }

  return syncAwsCommitmentRecommendationsWithFreshness({
    tenantId,
    trigger: "MANUAL_API",
    maxAgeMinutes: env.optimizationCommitmentSyncFreshnessMinutes,
    billingSourceId,
    cloudConnectionId,
    recommendations,
  });
}

export async function triggerRightsizingRecommendationExecute({
  tenantId,
  recommendationId,
  requestedByUserId,
  dryRun = false,
  idempotencyKey,
}: {
  tenantId: string;
  recommendationId: string;
  requestedByUserId: string | null;
  dryRun?: boolean;
  idempotencyKey?: string | null;
}): Promise<RightsizingActionExecuteResult> {
  const result = await executeRightsizingAction({
    tenantId,
    recommendationId,
    requestedByUserId,
    dryRun,
    idempotencyKey,
  });

  void processQueuedRightsizingActions().catch((error) => {
    logger.warn("Rightsizing action immediate processor run failed", {
      tenantId,
      recommendationId,
      actionId: result.actionId,
      reason: error instanceof Error ? error.message : String(error),
    });
  });

  return result;
}

export async function getRightsizingActionStatusData({
  tenantId,
  actionId,
}: {
  tenantId: string;
  actionId: string;
}): Promise<RightsizingActionStatusResult | null> {
  return getRightsizingActionStatus({
    tenantId,
    actionId,
  });
}

export async function ignoreRightsizingRecommendation({
  tenantId,
  recommendationId,
}: {
  tenantId: string;
  recommendationId: string;
}): Promise<{ recommendationId: string; status: "IGNORED" }> {
  return sequelize.transaction(async (transaction) => {
    const recommendationRows = await sequelize.query<{ id: string | number; status: string }>(
      `
        SELECT fr.id, fr.status
        FROM fact_recommendations fr
        WHERE fr.tenant_id = $1
          AND fr.id = $2
          AND ${RIGHTSIZING_PREDICATE_SQL}
        LIMIT 1;
      `,
      {
        bind: [tenantId, recommendationId],
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    const row = recommendationRows[0];
    if (!row) throw new NotFoundError("Rightsizing recommendation not found");

    const status = String(row.status ?? "").trim().toUpperCase();
    if (status === "IN_PROGRESS") throw new ConflictError("Recommendation is currently in progress");
    if (status === "APPLIED") throw new ConflictError("Recommendation is already applied");
    if (status === "IGNORED") {
      return {
        recommendationId: String(row.id),
        status: "IGNORED",
      };
    }

    const activeActionRows = await sequelize.query<{ id: string | number }>(
      `
        SELECT id
        FROM fact_recommendation_actions
        WHERE tenant_id = $1
          AND recommendation_id = $2
          AND action_type = 'APPLY_RIGHTSIZING'
          AND status IN ('QUEUED', 'RUNNING')
        LIMIT 1;
      `,
      {
        bind: [tenantId, recommendationId],
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    if (activeActionRows.length > 0) throw new ConflictError("A rightsizing action is already running");

    await sequelize.query(
      `
        UPDATE fact_recommendations
        SET status = 'IGNORED',
            updated_at = NOW()
        WHERE tenant_id = $1
          AND id = $2;
      `,
      {
        bind: [tenantId, recommendationId],
        transaction,
      },
    );

    return {
      recommendationId: String(row.id),
      status: "IGNORED",
    };
  });
}

export async function triggerIdleRecommendationExecute({
  tenantId,
  recommendationId,
  requestedByUserId,
  dryRun = false,
  idempotencyKey,
}: {
  tenantId: string;
  recommendationId: string;
  requestedByUserId: string | null;
  dryRun?: boolean;
  idempotencyKey?: string | null;
}): Promise<IdleActionExecuteResult> {
  const result = await executeIdleAction({
    tenantId,
    recommendationId,
    requestedByUserId,
    dryRun,
    idempotencyKey,
  });

  void processQueuedIdleActions().catch((error) => {
    logger.warn("Idle action immediate processor run failed", {
      tenantId,
      recommendationId,
      actionId: result.actionId,
      reason: error instanceof Error ? error.message : String(error),
    });
  });

  return result;
}

export async function getIdleActionStatusData({
  tenantId,
  actionId,
}: {
  tenantId: string;
  actionId: string;
}): Promise<IdleActionStatusResult | null> {
  return getIdleActionStatus({
    tenantId,
    actionId,
  });
}

export async function ignoreIdleRecommendation({
  tenantId,
  recommendationId,
}: {
  tenantId: string;
  recommendationId: string;
}): Promise<{ recommendationId: string; status: "IGNORED" }> {
  return sequelize.transaction(async (transaction) => {
    const recommendationRows = await sequelize.query<{ id: string | number; status: string }>(
      `
        SELECT fr.id, fr.status
        FROM fact_recommendations fr
        WHERE fr.tenant_id = $1
          AND fr.id = $2
          AND ${IDLE_PREDICATE_SQL}
        LIMIT 1;
      `,
      {
        bind: [tenantId, recommendationId],
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    const row = recommendationRows[0];
    if (!row) throw new NotFoundError("Idle recommendation not found");

    const status = String(row.status ?? "").trim().toUpperCase();
    if (status === "IN_PROGRESS") throw new ConflictError("Recommendation is currently in progress");
    if (status === "APPLIED") throw new ConflictError("Recommendation is already applied");
    if (status === "IGNORED") {
      return {
        recommendationId: String(row.id),
        status: "IGNORED",
      };
    }

    const activeActionRows = await sequelize.query<{ id: string | number }>(
      `
        SELECT id
        FROM fact_recommendation_actions
        WHERE tenant_id = $1
          AND recommendation_id = $2
          AND action_type IN ('APPLY_IDLE_DELETE_EBS', 'APPLY_IDLE_RELEASE_EIP', 'APPLY_IDLE_DELETE_SNAPSHOT')
          AND status IN ('QUEUED', 'RUNNING')
        LIMIT 1;
      `,
      {
        bind: [tenantId, recommendationId],
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    if (activeActionRows.length > 0) throw new ConflictError("An idle action is already running");

    await sequelize.query(
      `
        UPDATE fact_recommendations
        SET status = 'IGNORED',
            updated_at = NOW()
        WHERE tenant_id = $1
          AND id = $2;
      `,
      {
        bind: [tenantId, recommendationId],
        transaction,
      },
    );

    return {
      recommendationId: String(row.id),
      status: "IGNORED",
    };
  });
}

export async function getOptimizationRecommendationDebugData(
  tenantId: string,
): Promise<OptimizationRecommendationDebugData> {
  const statsRows = await sequelize.query<RecommendationDebugStatsRow>(
    `
      SELECT
        COUNT(*)::bigint AS total_rows,
        COUNT(*) FILTER (WHERE UPPER(fr.status) = 'OPEN')::bigint AS open_rows,
        COUNT(*) FILTER (WHERE ${RIGHTSIZING_PREDICATE_SQL})::bigint AS rightsizing_rows,
        COUNT(*) FILTER (WHERE fr.cloud_connection_id IS NOT NULL)::bigint AS rows_with_cloud_connection,
        COUNT(*) FILTER (WHERE fr.billing_source_id IS NOT NULL)::bigint AS rows_with_billing_source,
        COUNT(DISTINCT fr.aws_account_id)::bigint AS distinct_accounts,
        MAX(fr.updated_at)::text AS latest_updated_at
      FROM fact_recommendations fr
      WHERE fr.tenant_id = $1;
    `,
    {
      bind: [tenantId],
      type: QueryTypes.SELECT,
    },
  );

  const sampleRows = await sequelize.query<RecommendationDebugSampleRow>(
    `
      SELECT
        fr.id,
        fr.aws_account_id,
        fr.aws_region_code,
        fr.resource_id,
        fr.status,
        fr.estimated_monthly_savings,
        fr.cloud_connection_id,
        fr.billing_source_id,
        fr.updated_at::text AS updated_at
      FROM fact_recommendations fr
      WHERE fr.tenant_id = $1
        AND ${RIGHTSIZING_PREDICATE_SQL}
      ORDER BY fr.updated_at DESC
      LIMIT 10;
    `,
    {
      bind: [tenantId],
      type: QueryTypes.SELECT,
    },
  );

  const stats = statsRows[0];
  return {
    stats: {
      totalRows: toNumber(stats?.total_rows),
      openRows: toNumber(stats?.open_rows),
      rightsizingRows: toNumber(stats?.rightsizing_rows),
      rowsWithCloudConnection: toNumber(stats?.rows_with_cloud_connection),
      rowsWithBillingSource: toNumber(stats?.rows_with_billing_source),
      distinctAccounts: toNumber(stats?.distinct_accounts),
      latestUpdatedAt: stats?.latest_updated_at ?? null,
    },
    sampleRows: sampleRows.map((row) => ({
      id: String(row.id),
      awsAccountId: row.aws_account_id,
      awsRegionCode: row.aws_region_code,
      resourceId: row.resource_id,
      status: row.status,
      estimatedMonthlySavings: toNumber(row.estimated_monthly_savings),
      cloudConnectionId: row.cloud_connection_id ?? null,
      billingSourceId:
        row.billing_source_id === null || typeof row.billing_source_id === "undefined"
          ? null
          : String(row.billing_source_id),
      updatedAt: row.updated_at,
    })),
  };
}
