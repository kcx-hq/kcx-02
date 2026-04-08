import { QueryTypes } from "sequelize";
import { sequelize } from "../../../models/index.js";
import type { DashboardSectionResponse } from "../overview/overview.service.js";
import { syncAwsRightsizingRecommendations } from "./recommendation-sync/sync.service.js";
import type { AwsComputeOptimizerEc2RecommendationInput, OptimizationSyncResult } from "./recommendation-sync/types.js";

type OptimizationSummaryRow = {
  open_recommendations: number | string | null;
  potential_savings: number | string | null;
  implemented_this_month: number | string | null;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

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
