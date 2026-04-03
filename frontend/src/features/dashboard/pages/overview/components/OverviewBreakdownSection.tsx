import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { CostBreakdownItem, OverviewAnomaly } from "../../../api/dashboardApi";
import { BaseEChart, ChartPlaceholder } from "../../../common/charts";
import { currencyFormatterCompact, percentFormatter } from "../utils/overviewFormatters";

type OverviewBreakdownSectionProps = {
  topServices: CostBreakdownItem[];
  topAccounts: CostBreakdownItem[];
  anomalies: OverviewAnomaly[];
  selectedServiceKey: number | null;
  selectedAccountKey: number | null;
  onSelectService: (key: number | null) => void;
  onSelectAccount: (key: number | null) => void;
};

export function OverviewBreakdownSection({
  topServices,
  topAccounts,
  anomalies,
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
        <h3 className="overview-breakdown-panel__title">Top Accounts</h3>
        <div className="overview-accounts-layout">
          <div className="overview-breakdown-donut">
            {accountItems.length ? <BaseEChart option={accountDonutOption} height={260} /> : <ChartPlaceholder />}
          </div>
        </div>
      </article>

      <article className="overview-breakdown-panel">
        <h3 className="overview-breakdown-panel__title">Top Threat Categories</h3>
        <div className="overview-threat-list">
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
        <div className="overview-threat-legend">
          {threatSegments.map((segment) => (
            <span key={`threat-legend-${segment.key}`} className="overview-threat-legend__item">
              <span className="overview-threat-legend__dot" style={{ backgroundColor: segment.color }} aria-hidden="true" />
              {segment.label}
            </span>
          ))}
        </div>
      </article>
    </section>
  );
}
