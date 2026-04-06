import { calculateDeltaPercent, compactCurrencyFormatter, percentFormatter } from "../costExplorer.utils";
import type { Metric } from "../costExplorer.types";

type CostExplorerInsightsStripProps = {
  spend: number;
  previousSpend: number;
  forecastSpend: number;
  metric: Metric;
};

export function CostExplorerInsightsStrip({
  spend,
  previousSpend,
  forecastSpend,
  metric,
}: CostExplorerInsightsStripProps) {
  const previousDelta = calculateDeltaPercent(spend, previousSpend);
  const forecastDelta = calculateDeltaPercent(forecastSpend, spend);

  return (
    <section className="cost-explorer-insight-strip" aria-label="Summary insights">
      <article className="cost-explorer-insight-card">
        <p className="cost-explorer-insight-card__label">Period Spend</p>
        <p className="cost-explorer-insight-card__value">{compactCurrencyFormatter.format(spend)}</p>
        <p className="cost-explorer-insight-card__meta">{metric === "billed" ? "Billed basis" : "Effective basis"}</p>
      </article>
      <article className="cost-explorer-insight-card">
        <p className="cost-explorer-insight-card__label">Previous Period</p>
        <p className="cost-explorer-insight-card__value">{compactCurrencyFormatter.format(previousSpend)}</p>
        <p className={`cost-explorer-insight-card__meta${previousDelta >= 0 ? " is-negative" : " is-positive"}`}>
          {previousDelta >= 0 ? "+" : ""}
          {percentFormatter.format(previousDelta)}%
        </p>
      </article>
      <article className="cost-explorer-insight-card">
        <p className="cost-explorer-insight-card__label">Forecast Variance</p>
        <p className="cost-explorer-insight-card__value">
          {forecastDelta >= 0 ? "+" : ""}
          {percentFormatter.format(forecastDelta)}%
        </p>
        <p className="cost-explorer-insight-card__meta">Compared to current trend</p>
      </article>
    </section>
  );
}
