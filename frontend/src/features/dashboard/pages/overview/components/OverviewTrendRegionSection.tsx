import { useMemo } from "react";
import type { BudgetActualForecastPoint, CostBreakdownItem } from "../../../api/dashboardApi";
import { BaseEChart } from "../../../common/charts/BaseEChart";
import { TopRegionsGeoMap } from "../../../common/charts/TopRegionsGeoMap";
import { buildTrendOption } from "../utils/overviewFormatters";

type OverviewTrendRegionSectionProps = {
  trendData: BudgetActualForecastPoint[];
  topRegions: CostBreakdownItem[];
};

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatPercent = (value: number) => `${value.toFixed(2)}%`;

export function OverviewTrendRegionSection({ trendData, topRegions }: OverviewTrendRegionSectionProps) {
  const trendOption = useMemo(() => buildTrendOption(trendData), [trendData]);
  const trendHasData = trendData.length > 0;

  const topRegionHighlights = useMemo(() => {
    const sorted = [...topRegions].sort((a, b) => b.billedCost - a.billedCost);
    const topFive = sorted.slice(0, 5);
    const topFiveShare = topFive.reduce((sum, region) => sum + Number(region.contributionPct ?? 0), 0);
    const totalSpend = sorted.reduce((sum, region) => sum + Number(region.billedCost ?? 0), 0);

    return {
      topFive,
      topFiveShare,
      totalSpend,
      totalRegions: sorted.length,
    };
  }, [topRegions]);

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
                <p className="overview-top-regions__subtitle">Where cloud spend is concentrated right now</p>
              </div>

              <div className="overview-top-regions__meta">
                <div className="overview-top-regions__meta-pill">
                  <span className="overview-top-regions__meta-label">Top 5 Share</span>
                  <strong className="overview-top-regions__meta-value">{formatPercent(topRegionHighlights.topFiveShare)}</strong>
                </div>
                <div className="overview-top-regions__meta-pill">
                  <span className="overview-top-regions__meta-label">Regional Spend</span>
                  <strong className="overview-top-regions__meta-value">{formatCurrency(topRegionHighlights.totalSpend)}</strong>
                </div>
                <div className="overview-top-regions__meta-pill">
                  <span className="overview-top-regions__meta-label">Tracked Regions</span>
                  <strong className="overview-top-regions__meta-value">{topRegionHighlights.totalRegions}</strong>
                </div>
              </div>

              <div className="overview-top-regions__map">
                <TopRegionsGeoMap height={220} data={topRegions} />
              </div>

              {topRegionHighlights.topFive.length ? (
                <ol className="overview-top-regions__list" aria-label="Top regions ranking">
                  {topRegionHighlights.topFive.map((region, index) => (
                    <li key={`${region.key ?? region.name}-${index}`} className="overview-top-regions__item">
                      <span className="overview-top-regions__rank">{index + 1}</span>
                      <span className="overview-top-regions__name" title={region.name}>
                        {region.name}
                      </span>
                      <span className="overview-top-regions__cost">{formatCurrency(region.billedCost)}</span>
                      <span className="overview-top-regions__share">{formatPercent(region.contributionPct)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="dashboard-note">No region data available for current filters.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
