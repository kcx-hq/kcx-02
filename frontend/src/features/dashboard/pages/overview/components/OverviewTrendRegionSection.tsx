import { useMemo } from "react";
import type { BudgetActualForecastPoint, CostBreakdownItem } from "../../../api/dashboardApi";
import { BaseEChart } from "../../../common/charts/BaseEChart";
import { TopRegionsGeoMap } from "../../../common/charts/TopRegionsGeoMap";
import { buildTrendOption } from "../utils/overviewFormatters";

type OverviewTrendRegionSectionProps = {
  trendData: BudgetActualForecastPoint[];
  topRegions: CostBreakdownItem[];
};

export function OverviewTrendRegionSection({ trendData, topRegions }: OverviewTrendRegionSectionProps) {
  const trendOption = useMemo(() => buildTrendOption(trendData), [trendData]);
  const trendHasData = trendData.length > 0;

  return (
    <section className="overview-plain-section">
      <div className="overview-trend-unified">
        <div className="overview-trend-unified__header">
          <h2 className="overview-plain-section__title">Budget vs Actual vs Forecast</h2>
          <p className="overview-trend-unified__subtitle">Monthly cost trajectory with geographic spend concentration</p>
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
          <div className="overview-trend-pane overview-trend-pane--map">
            <div className="overview-top-regions">
              <div className="overview-top-regions__header">
                <h3 className="overview-top-regions__title">Top Regions</h3>
              </div>

              <div className="overview-top-regions__map">
                <TopRegionsGeoMap height={290} data={topRegions} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
