import { useMemo } from "react";
import type { BudgetActualForecastPoint, CostBreakdownItem } from "../../../api/dashboardApi";
import { BaseEChart } from "../../../common/charts/BaseEChart";
import { TOP_THREE_REGION_COLORS, TopRegionsGeoMap } from "../../../common/charts/TopRegionsGeoMap";
import { buildTrendOption } from "../utils/overviewFormatters";

type OverviewTrendRegionSectionProps = {
  trendData: BudgetActualForecastPoint[];
  topRegions: CostBreakdownItem[];
};

export function OverviewTrendRegionSection({ trendData, topRegions }: OverviewTrendRegionSectionProps) {
  const trendOption = useMemo(() => buildTrendOption(trendData), [trendData]);
  const trendHasData = trendData.length > 0;
  const top3RegionLegend = useMemo(() => {
    const sorted = [...topRegions].sort((a, b) => b.billedCost - a.billedCost);
    const seenNames = new Set<string>();
    const uniqueTop3: CostBreakdownItem[] = [];

    for (const item of sorted) {
      const normalized = item.name.trim().toLowerCase();
      if (seenNames.has(normalized)) {
        continue;
      }
      seenNames.add(normalized);
      uniqueTop3.push(item);
      if (uniqueTop3.length >= 3) {
        break;
      }
    }

    return uniqueTop3.map((item, index) => ({
      name: item.name,
      color: TOP_THREE_REGION_COLORS[index % TOP_THREE_REGION_COLORS.length],
    }));
  }, [topRegions]);

  return (
    <section className="overview-plain-section">
      <div className="overview-trend-unified">
        <div className="overview-trend-unified__header">
          <h2 className="overview-plain-section__title">Budget vs Actual vs Forecast</h2>
          <div className="overview-trend-header-side">
            <h3 className="overview-trend-unified__side-title">Top Regions</h3>
            {top3RegionLegend.length ? (
              <div className="overview-trend-header-legend" aria-label="Top region color mapping">
                {top3RegionLegend.map((region) => (
                  <span className="overview-trend-header-legend__item" key={region.name}>
                    <span
                      className="overview-trend-header-legend__dot"
                      style={{ backgroundColor: region.color }}
                      aria-hidden="true"
                    />
                    <span className="overview-trend-header-legend__name" title={region.name}>
                      {region.name}
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
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
          <div className="overview-trend-pane overview-trend-pane--map overview-trend-pane--map-direct">
            <TopRegionsGeoMap height={314} data={topRegions} />
          </div>
        </div>
      </div>
    </section>
  );
}
