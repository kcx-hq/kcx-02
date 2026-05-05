import { KpiCard, KpiGrid } from "../../../common/components";
import type { DatabaseAssetsSummary } from "../../../api/dashboardTypes";
import { formatCurrency, formatInteger, formatPercent, formatStorageGb } from "./db-assets.formatters";

type DatabaseAssetsCardsProps = {
  summary: DatabaseAssetsSummary;
  isLoading?: boolean;
};

const loadingSummary: DatabaseAssetsSummary = {
  totalAssets: 0,
  totalCost: 0,
  avgCpu: null,
  totalStorageGb: null,
  recommendationCount: 0,
};

export function DatabaseAssetsCards({ summary, isLoading = false }: DatabaseAssetsCardsProps) {
  const safeSummary = isLoading ? loadingSummary : summary;

  return (
    <KpiGrid className="db-explorer-kpi-grid">
      <KpiCard label="Total Assets" value={formatInteger(safeSummary.totalAssets)} />
      <KpiCard label="Total Cost" value={formatCurrency(safeSummary.totalCost)} />
      <KpiCard label="Avg CPU" value={formatPercent(safeSummary.avgCpu)} />
      <KpiCard label="Total Storage" value={formatStorageGb(safeSummary.totalStorageGb)} />
      <KpiCard label="Recommendation Count" value={formatInteger(safeSummary.recommendationCount)} />
    </KpiGrid>
  );
}
