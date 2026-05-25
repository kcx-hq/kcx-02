import { KpiCard, KpiGrid } from "../../../common/components";
import type {
  DatabaseExplorerCards as DatabaseExplorerCardsData,
} from "../../../api/dashboardTypes";
import {
  NULL_MARKER,
} from "./databaseExplorer.formatters";

type DatabaseExplorerCardsProps = {
  cards: DatabaseExplorerCardsData;
  isLoading?: boolean;
};

export function DatabaseExplorerCards({ cards, isLoading = false }: DatabaseExplorerCardsProps) {
  const safeCards = isLoading ? [] : cards;

  return (
    <KpiGrid className="db-explorer-kpi-grid">
      {safeCards.map((card) => {
        const tone =
          card.state === "warning"
            ? "negative"
            : card.state === "unavailable" || card.state === "partial"
              ? "neutral"
              : card.trend?.direction === "up"
                ? "negative"
                : card.trend?.direction === "down"
                  ? "positive"
                  : "neutral";
        const trendLabel =
          card.trend?.value === null || typeof card.trend?.value === "undefined"
            ? undefined
            : `${card.trend.value >= 0 ? "+" : ""}${(card.trend.value * 100).toFixed(1)}%`;

        return (
          <KpiCard
            key={card.id}
            label={card.title}
            value={card.value || NULL_MARKER}
            delta={trendLabel}
            deltaTone={tone}
            meta={card.subValue ?? card.note ?? undefined}
          />
        );
      })}
    </KpiGrid>
  );
}
