import { useMemo } from "react";
import type { BudgetActualForecastPoint, OverviewAnomaly } from "../../../api/dashboardApi";
import { BaseEChart } from "../../../common/charts/BaseEChart";
import { buildTrendOption } from "../utils/overviewFormatters";

type OverviewTrendRegionSectionProps = {
  trendData: BudgetActualForecastPoint[];
  anomalies: OverviewAnomaly[];
};

export function OverviewTrendRegionSection({ trendData, anomalies }: OverviewTrendRegionSectionProps) {
  const trendOption = useMemo(() => buildTrendOption(trendData), [trendData]);
  const trendHasData = trendData.length > 0;
  const topThreats = useMemo(() => {
    const grouped = new Map<string, { name: string; high: number; low: number; medium: number; total: number }>();

    for (const anomaly of anomalies) {
      const label = anomaly.serviceName?.trim() || "Uncategorized";
      const current = grouped.get(label) ?? { name: label, high: 0, low: 0, medium: 0, total: 0 };
      const severity = anomaly.severity?.toLowerCase() ?? "medium";

      if (severity === "high") current.high += 1;
      else if (severity === "low") current.low += 1;
      else current.medium += 1;

      current.total += 1;
      grouped.set(label, current);
    }

    return [...grouped.values()].sort((a, b) => b.total - a.total).slice(0, 3);
  }, [anomalies]);

  const threatSegments = [
    { key: "high", label: "High", color: "#E15B66" },
    { key: "low", label: "Low", color: "#7CB9DE" },
    { key: "medium", label: "Medium", color: "#E4BC74" },
  ] as const;

  return (
    <section className="overview-plain-section">
      <div className="overview-trend-unified">
        <div className="overview-trend-unified__header">
          <div>
            <h2 className="overview-plain-section__title">Budget vs Actual vs Forecast</h2>
          </div>
          <div className="overview-trend-header-side overview-trend-header-side--threat">
            <h3 className="overview-trend-unified__side-title">Top Threat Categories</h3>
          </div>
        </div>
        <div className="overview-trend-unified__body">
          <div className="overview-trend-pane overview-trend-pane--chart">
            {trendHasData ? (
              <div className="overview-trend overview-trend--plain">
                <BaseEChart option={trendOption} height={290} />
              </div>
            ) : (
              <p className="dashboard-note">No trend data available for current filters.</p>
            )}
          </div>
          <div className="overview-trend-pane overview-trend-pane--threat">
            <div className="overview-threat-list overview-threat-list--compact">
              {topThreats.length ? (
                topThreats.map((threat) => (
                  <div key={threat.name} className="overview-threat-row">
                    <div className="overview-threat-row__label" title={threat.name}>
                      {threat.name}
                    </div>
                    <div className="overview-threat-row__stack">
                      {threatSegments.map((segment) => {
                        const value = threat[segment.key];
                        if (!value) {
                          return null;
                        }

                        const width = threat.total > 0 ? (value / threat.total) * 100 : 0;

                        return (
                          <span
                            key={`${threat.name}-${segment.key}`}
                            className="overview-threat-row__segment"
                            style={{ width: `${width}%`, backgroundColor: segment.color }}
                            title={`${segment.label}: ${value}`}
                          >
                            {value}
                          </span>
                        );
                      })}
                    </div>
                    <span className="overview-threat-row__total">{threat.total}</span>
                  </div>
                ))
              ) : (
                <p className="overview-breakdown-note">No anomaly data found for selected filters.</p>
              )}
            </div>
            <div className="overview-threat-legend overview-threat-legend--inline">
              {threatSegments.map((segment) => (
                <span key={`threat-legend-${segment.key}`} className="overview-threat-legend__item">
                  <span className="overview-threat-legend__dot" style={{ backgroundColor: segment.color }} aria-hidden="true" />
                  {segment.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
