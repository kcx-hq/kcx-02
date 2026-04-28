import { KpiCard, KpiGrid } from "../../../common/components";
import type { DatabaseExplorerCards as DatabaseExplorerCardsData } from "../../../api/dashboardTypes";
import {
  NULL_MARKER,
  formatCompactCurrency,
  formatCompactNumber,
  formatInteger,
  formatNumber,
  formatPercentFromRatio,
} from "./databaseExplorer.formatters";

type DatabaseExplorerCardsProps = {
  cards: DatabaseExplorerCardsData;
  isLoading?: boolean;
};

const loadingCards: DatabaseExplorerCardsData = {
  totalCost: 0,
  costTrendPct: null,
  activeResources: 0,
  dataFootprintGb: 0,
  avgLoad: null,
  connections: null,
};

export function DatabaseExplorerCards({ cards, isLoading = false }: DatabaseExplorerCardsProps) {
  const safeCards = isLoading ? loadingCards : cards;
  const trendTone =
    safeCards.costTrendPct === null ? "neutral" : safeCards.costTrendPct > 0 ? "negative" : "positive";

  return (
    <KpiGrid>
      <KpiCard label="Total Cost" value={formatCompactCurrency(safeCards.totalCost)} />
      <KpiCard
        label="Cost Trend %"
        value={isLoading ? NULL_MARKER : formatPercentFromRatio(safeCards.costTrendPct)}
        deltaTone={trendTone}
      />
      <KpiCard label="Active DB Resources" value={formatInteger(safeCards.activeResources)} />
      <KpiCard label="Data Footprint" value={formatNumber(safeCards.dataFootprintGb, " GB")} />
      <KpiCard label="Avg Load" value={formatCompactNumber(safeCards.avgLoad)} />
      <KpiCard label="Connections / Throughput" value={formatCompactNumber(safeCards.connections)} />
    </KpiGrid>
  );
}
