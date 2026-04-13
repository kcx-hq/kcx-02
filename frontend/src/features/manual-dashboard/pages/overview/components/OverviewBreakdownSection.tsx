import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { CostBreakdownItem } from "../../../api/dashboardApi";
import { BaseEChart, ChartPlaceholder } from "../../../common/charts";
import { TOP_THREE_REGION_COLORS, TopRegionsGeoMap } from "../../../common/charts/TopRegionsGeoMap";
import { currencyFormatterCompact, percentFormatter } from "../utils/overviewFormatters";

type OverviewBreakdownSectionProps = {
  topServices: CostBreakdownItem[];
  topAccounts: CostBreakdownItem[];
  topRegions: CostBreakdownItem[];
  selectedServiceKey: number | null;
  selectedAccountKey: number | null;
  onSelectService: (key: number | null) => void;
  onSelectAccount: (key: number | null) => void;
};

export function OverviewBreakdownSection({
  topServices,
  topAccounts,
  topRegions,
  selectedServiceKey: _selectedServiceKey,
  selectedAccountKey: _selectedAccountKey,
  onSelectService: _onSelectService,
  onSelectAccount: _onSelectAccount,
}: OverviewBreakdownSectionProps) {
  const serviceItems = useMemo(() => topServices.slice(0, 5), [topServices]);
  const accountItems = useMemo(() => topAccounts.slice(0, 5), [topAccounts]);

  const servicePalette = useMemo(() => ["#2563eb", "#f59e0b", "#8b5cf6", "#1f8b7a", "#D94B63"], []);

  const accountPalette = useMemo(() => ["#1f8b7a", "#8b5cf6", "#f59e0b", "#2563eb", "#D94B63"], []);

  const buildDonutOption = (
    chartName: string,
    itemNameFallback: string,
    items: CostBreakdownItem[],
    palette: string[],
  ): EChartsOption => ({
    color: palette,
    tooltip: {
      trigger: "item",
      formatter: (params: any) => {
        const rawValue =
          typeof params.value === "number" ? params.value : Number(Array.isArray(params.value) ? params.value[1] : params.value);
        const formattedValue = Number.isFinite(rawValue) ? rawValue : 0;
        const percent = typeof params.percent === "number" ? params.percent : 0;
        return `${params.name ?? itemNameFallback}<br/>${currencyFormatterCompact.format(formattedValue)} (${percentFormatter.format(
          percent,
        )}%)`;
      },
    },
    series: [
      {
        name: chartName,
        type: "pie",
        colorBy: "data",
        radius: ["45%", "68%"],
        center: ["50%", "54%"],
        minAngle: 3,
        minShowLabelAngle: 3,
        avoidLabelOverlap: true,
        label: {
          show: true,
          position: "outside",
          alignTo: "labelLine",
          edgeDistance: 12,
          distanceToLabelLine: 2,
          formatter: (params: any) => `{name|${params.name ?? itemNameFallback}}`,
          rich: {
            name: {
              color: "#2f3a45",
              fontSize: 10,
              fontWeight: 600,
              lineHeight: 14,
            },
          },
        },
        labelLine: {
          show: true,
          length: 16,
          length2: 24,
          lineStyle: {
            color: "#9aa8b4",
            width: 1.1,
          },
        },
        itemStyle: {
          borderWidth: 2,
          borderColor: "#f6f9fb",
        },
        data: items.map((item, index) => ({
          name: item.name,
          value: item.billedCost,
          itemStyle: {
            color: palette[index % palette.length],
          },
        })),
      },
    ],
  });

  const serviceDonutOption = useMemo<EChartsOption>(
    () => buildDonutOption("Top Services", "Service", serviceItems, servicePalette),
    [serviceItems, servicePalette],
  );

  const accountDonutOption = useMemo<EChartsOption>(
    () => buildDonutOption("Top Accounts", "Account", accountItems, accountPalette),
    [accountItems, accountPalette],
  );

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
    <section className="overview-breakdown-modern">
      <article className="overview-breakdown-panel">
        <h3 className="overview-breakdown-panel__title">Top Services</h3>
        <div className="overview-services-list">
          <div className="overview-breakdown-donut">
            {serviceItems.length ? <BaseEChart option={serviceDonutOption} height={260} /> : <p className="overview-breakdown-note">No services found for selected filters.</p>}
          </div>
        </div>
      </article>

      <article className="overview-breakdown-panel">
        <div className="overview-top-regions__heading">
          <h3 className="overview-breakdown-panel__title">Top Regions</h3>
          {top3RegionLegend.length ? (
            <div className="overview-top-regions__legend" aria-label="Top region color mapping">
              {top3RegionLegend.map((region) => (
                <span className="overview-top-regions__legend-item" key={region.name}>
                  <span className="overview-top-regions__legend-dot" style={{ backgroundColor: region.color }} aria-hidden="true" />
                  <span className="overview-top-regions__legend-name" title={region.name}>
                    {region.name}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="overview-top-regions overview-top-regions--compact">
          <div className="overview-top-regions__map">
            <TopRegionsGeoMap height={260} data={topRegions} />
          </div>
        </div>
      </article>

      <article className="overview-breakdown-panel">
        <h3 className="overview-breakdown-panel__title">Top Accounts</h3>
        <div className="overview-accounts-layout">
          <div className="overview-breakdown-donut">
            {accountItems.length ? <BaseEChart option={accountDonutOption} height={260} /> : <ChartPlaceholder />}
          </div>
        </div>
      </article>
    </section>
  );
}
