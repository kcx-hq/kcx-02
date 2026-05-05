import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useInventoryEc2InstanceDetail } from "@/features/client-home/hooks/useInventoryEc2Instances";
import { EmptyStateBlock } from "@/features/dashboard/common/components/EmptyStateBlock";

import {
  CostDriversSection,
  DecisionSummaryCard,
  KeySignalsGrid,
  MetadataSection,
  NetworkDetailsSection,
  PerformanceSection,
  RecommendationCard,
  StickySectionNav,
  networkBreakdownColorAt,
  volumeColumnsFactory,
  type DecisionStatus,
} from "./components/EC2InstanceDetailDecisionLayout";

const VOLUMES_PAGE_PATH = "/dashboard/inventory/aws/ec2/volumes";
const INSTANCES_PAGE_PATH = "/dashboard/inventory/aws/ec2/instances";
const OPTIMIZATION_PAGE_PATH = "/dashboard/ec2/optimization";

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);
const getDefaultDateRange = (): { start: string; end: string } => {
  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return { start: toIsoDate(startOfMonth), end: toIsoDate(today) };
};

const toTitle = (value: string): string => value.replaceAll("_", " ").replaceAll("-", " ").split(" ").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
const formatCurrency = (value: number | null | undefined): string => value === null || typeof value === "undefined" || !Number.isFinite(value) ? "-" : CURRENCY_FORMATTER.format(value);
const formatPercent = (value: number | null | undefined): string => value === null || typeof value === "undefined" || !Number.isFinite(value) ? "-" : `${DECIMAL_FORMATTER.format(value)}%`;
const formatNumber = (value: number | null | undefined): string => value === null || typeof value === "undefined" || !Number.isFinite(value) ? "-" : DECIMAL_FORMATTER.format(value);
const formatSize = (value: number | null | undefined): string => value === null || typeof value === "undefined" || !Number.isFinite(value) ? "-" : `${value.toLocaleString()} GB`;
const bytesToGb = (value: number | null | undefined): number => value === null || typeof value === "undefined" || !Number.isFinite(value) ? 0 : value / (1024 * 1024 * 1024);

const toPricingLabel = (value: "on_demand" | "reserved" | "savings_plan" | "spot" | "other" | null): string => {
  if (value === "on_demand") return "On-Demand";
  if (value === "reserved") return "RI";
  if (value === "savings_plan") return "SP";
  if (value === "spot") return "Spot";
  if (value === "other") return "Other";
  return "Unknown";
};

const recommendationTypeLabel = (value: string): string =>
  value === "high_internet_data_transfer" ? "High Internet Data Transfer"
    : value === "high_inter_region_data_transfer" ? "High Inter-Region Data Transfer"
    : value === "high_inter_az_data_transfer" ? "High Inter-AZ Data Transfer"
    : value === "low_cpu_high_network" ? "Low CPU / High Network"
    : value === "high_nat_gateway_cost" ? "High NAT Gateway Cost"
    : value === "unattached_elastic_ip" ? "Unattached Elastic IP"
    : toTitle(value);

const getTagValue = (tags: Record<string, unknown>, key: string): string => {
  const exact = tags[key];
  if (typeof exact === "string" && exact.trim().length > 0) return exact;
  const found = Object.entries(tags).find(([k]) => k.toLowerCase() === key.toLowerCase());
  return found ? String(found[1]) : "-";
};

const isRiskRecommendation = (risk: string): boolean => ["high", "critical"].includes(risk.toLowerCase());
const isNetworkRecommendationType = (type: string): boolean => /(network|data_transfer|inter_az|inter_region|internet|nat_gateway)/i.test(type);

export default function EC2InstanceDetailPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const defaults = getDefaultDateRange();
  const startDate = queryParams.get("startDate") ?? queryParams.get("from") ?? queryParams.get("billingPeriodStart") ?? defaults.start;
  const endDate = queryParams.get("endDate") ?? queryParams.get("to") ?? queryParams.get("billingPeriodEnd") ?? defaults.end;
  const cloudConnectionId = queryParams.get("cloudConnectionId") ?? queryParams.get("cloud_connection_id");

  const detailQuery = useInventoryEc2InstanceDetail({ instanceId: instanceId ?? "", cloudConnectionId, startDate, endDate });

  const backToInstances = () => {
    const next = new URLSearchParams(location.search);
    next.delete("instanceId");
    navigate({ pathname: INSTANCES_PAGE_PATH, search: next.toString() });
  };

  if (detailQuery.isLoading) return <div className="dashboard-page"><p className="dashboard-note">Loading instance details...</p></div>;

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="dashboard-page">
        <EmptyStateBlock
          title="Unable to load instance details"
          message={detailQuery.isError ? detailQuery.error.message : "Instance not found for selected filters."}
          actions={<button type="button" className="cost-explorer-state-btn" onClick={backToInstances}>Back to Instances</button>}
        />
      </div>
    );
  }

  const detail = detailQuery.data;
  const tags = detail.tags ?? {};

  const costRows = [
    { type: "Compute", cost: detail.costSummary.computeCost },
    { type: "EBS", cost: detail.costSummary.ebsCost },
    { type: "Network", cost: detail.costSummary.networkCost },
    { type: "Other", cost: detail.costSummary.otherCost },
  ].map((row) => ({ ...row, pct: detail.costSummary.totalCost > 0 ? (row.cost / detail.costSummary.totalCost) * 100 : 0 }));

  const totalSavings = detail.recommendations.reduce((sum, rec) => sum + (rec.saving ?? 0), 0);
  const hasRisk = detail.recommendations.some((rec) => isRiskRecommendation(rec.risk));
  const hasRecommendations = detail.recommendations.length > 0;
  const status: DecisionStatus = hasRisk ? "Risk Detected" : hasRecommendations ? "Optimization Opportunity" : "Healthy";
  const primaryIssue = detail.recommendations[0]?.problem ?? (detail.costSummary.ebsCost > detail.costSummary.computeCost ? `Primary driver: EBS is ${formatPercent(costRows.find((row) => row.type === "EBS")?.pct ?? 0)} of total cost` : "No major issue detected");
  const riskLevel = hasRisk ? "High" : hasRecommendations ? "Medium" : "Low";

  const networkBreakdownRows = [...(detail.networkInsight.breakdown ?? [])].filter((item) => item.cost > 0).sort((a, b) => b.cost - a.cost);

  const networkChart: EChartsOption = {
    tooltip: { trigger: "item", confine: true, valueFormatter: (value) => formatCurrency(Number(value ?? 0)) },
    legend: { show: true, bottom: 0, left: "center", textStyle: { fontSize: 11 } },
    series: [{
      type: "pie",
      radius: ["54%", "75%"],
      center: ["50%", "42%"],
      avoidLabelOverlap: true,
      label: { show: false },
      itemStyle: { borderRadius: 3, borderColor: "#fff", borderWidth: 1 },
      data: networkBreakdownRows.map((row, index) => ({ name: row.type, value: row.cost, itemStyle: { color: networkBreakdownColorAt(index) } })),
    }],
  };

  const dominantNetworkInsight = (() => {
    const recTypes = new Set(detail.recommendations.map((item) => item.type));
    if (recTypes.has("high_internet_data_transfer")) return "High internet data transfer detected.";
    if (recTypes.has("high_inter_region_data_transfer")) return "Cross-region network cost detected.";
    if (recTypes.has("low_cpu_high_network")) return "Low CPU but high network activity detected.";
    return null;
  })();

  const buildLineOption = (params: { labels: string[]; yAxisName: string; series: Array<{ name: string; data: Array<number | null | undefined> }>; legend?: string[]; }): EChartsOption => {
    const showLegend = (params.legend ?? []).length > 0;
    return {
      tooltip: { trigger: "axis", confine: true },
      legend: showLegend ? { show: true, type: "scroll", orient: "horizontal", top: 2, left: 58, right: 14, itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 11 } } : { show: false },
      grid: { left: 58, right: 14, top: showLegend ? 68 : 40, bottom: 34, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: params.labels, axisLabel: { hideOverlap: true, fontSize: 11 } },
      yAxis: { type: "value", name: params.yAxisName, nameLocation: "end", nameGap: 24, nameTextStyle: { fontSize: 11, color: "#6d837e" }, axisLabel: { fontSize: 11, margin: 10 } },
      series: params.series.map((item) => ({ name: item.name, type: "line", smooth: 0.42, showSymbol: false, symbol: "circle", symbolSize: 6, lineStyle: { width: 2.3 }, data: item.data })),
    };
  };

  const usageCpuOption = buildLineOption({
    labels: detail.trends.cpuTrend.map((d) => d.date),
    yAxisName: "%",
    legend: ["Avg CPU", "Max CPU"],
    series: [{ name: "Avg CPU", data: detail.trends.cpuTrend.map((d) => d.avgCpu) }, { name: "Max CPU", data: detail.trends.cpuTrend.map((d) => d.maxCpu ?? 0) }],
  });

  const usageNetworkOption = buildLineOption({
    labels: detail.trends.networkTrend.map((d) => d.date),
    yAxisName: "GB",
    legend: ["Network In", "Network Out"],
    series: [{ name: "Network In", data: detail.trends.networkTrend.map((d) => d.inGb) }, { name: "Network Out", data: detail.trends.networkTrend.map((d) => d.outGb) }],
  });

  const storageColumns = volumeColumnsFactory(formatSize, formatCurrency, formatNumber, toTitle);
  const metadataRows = Object.entries(tags).map(([key, value]) => ({ key, value: String(value) }));
  const showNetworkSection = detail.recommendations.some((rec) => isNetworkRecommendationType(rec.type));

  return (
    <div className="dashboard-page">
      <section className="ec2-instance-detail" aria-label="EC2 instance detail">
        

        <div className="ec2-instance-detail__layout">
          <div className="ec2-instance-detail__content">
            <DecisionSummaryCard
              status={status}
              totalCost={formatCurrency(detail.costSummary.totalCost)}
              potentialSavings={totalSavings > 0 ? `${formatCurrency(totalSavings)}/month savings available` : "No savings identified"}
              primaryIssue={primaryIssue}
              riskLevel={riskLevel}
              onViewActions={() => document.getElementById("actions")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            />

            <section id="actions" className="ec2-instance-detail__panel">
              <h3>Recommended Actions</h3>
              {detail.recommendations.length === 0 ? <p className="dashboard-note">No optimization opportunities found for this instance.</p> : (
                <div className="ec2-instance-detail__recommendation-grid">
                  {detail.recommendations.map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      recommendation={rec}
                      formatCurrency={formatCurrency}
                      toTitle={toTitle}
                      recommendationTypeLabel={recommendationTypeLabel}
                      onActionClick={(item) => {
                        if (!instanceId) return;
                        const next = new URLSearchParams(location.search);
                        next.set("resourceId", instanceId);
                        next.set("category", item.category);
                        next.set("issueType", item.type);
                        navigate({ pathname: OPTIMIZATION_PAGE_PATH, search: next.toString() });
                      }}
                    />
                  ))}
                </div>
              )}
            </section>

            <KeySignalsGrid items={[
              { label: "Total Cost", value: formatCurrency(detail.costSummary.totalCost) },
              { label: "Compute Cost", value: formatCurrency(detail.costSummary.computeCost) },
              { label: "Volume Cost", value: formatCurrency(detail.costSummary.ebsCost) },
              { label: "Avg CPU", value: formatPercent(detail.usageSummary.avgCpu) },
              { label: "Network Usage", value: `${formatNumber(bytesToGb(detail.usageSummary.networkUsageBytes))} GB` },
              { label: "Pricing Type", value: toPricingLabel(detail.pricingSummary.pricingType) },
              { label: "Instance Type", value: detail.identity.type ?? "-" },
              { label: "State", value: toTitle((detail.identity.state ?? "unknown").toLowerCase()) },
            ]} />

            <CostDriversSection
              costRows={costRows}
              totalCost={formatCurrency(detail.costSummary.totalCost)}
              ebsPct={formatPercent(costRows.find((row) => row.type === "EBS")?.pct ?? 0)}
              attachedVolumes={detail.attachedVolumes}
              storageColumns={storageColumns}
              formatCurrency={formatCurrency}
              formatPercent={formatPercent}
              onVolumeRowClick={(row) => {
                const next = new URLSearchParams(location.search);
                next.set("volumeId", row.volumeId);
                next.set("search", row.volumeId);
                navigate({ pathname: `${VOLUMES_PAGE_PATH}/${row.volumeId}`, search: next.toString() });
              }}
            />

            <PerformanceSection
              avgCpu={formatPercent(detail.usageSummary.avgCpu)}
              maxCpu={formatPercent(detail.usageSummary.maxCpu)}
              networkIn={`${formatNumber(bytesToGb(detail.usageSummary.networkInBytes))} GB`}
              networkOut={`${formatNumber(bytesToGb(detail.usageSummary.networkOutBytes))} GB`}
              cpuOption={usageCpuOption}
              networkOption={usageNetworkOption}
              hasCpuTrend={detail.trends.cpuTrend.length > 0}
              hasNetworkTrend={detail.trends.networkTrend.length > 0}
            />

            {showNetworkSection ? (
              <NetworkDetailsSection
                totalCost={formatCurrency(detail.networkInsight.totalNetworkCost)}
                totalUsage={`${formatNumber(detail.networkInsight.totalNetworkUsageGb)} GB`}
                rows={networkBreakdownRows}
                chartOption={networkChart}
                dominantInsight={dominantNetworkInsight}
                formatCurrency={formatCurrency}
                formatPercent={formatPercent}
                formatNumber={formatNumber}
              />
            ) : null}

            <MetadataSection
              values={[
                { label: "Team", value: getTagValue(tags, "Team") },
                { label: "Product", value: getTagValue(tags, "Product") },
                { label: "Environment", value: getTagValue(tags, "Environment") },
                { label: "Owner", value: getTagValue(tags, "Owner") },
                { label: "Region", value: detail.identity.region ?? "-" },
                { label: "Account", value: detail.identity.account ?? "-" },
                { label: "Availability Zone", value: detail.identity.availabilityZone ?? "-" },
                { label: "Launch Time", value: detail.identity.launchTime ? new Date(detail.identity.launchTime).toLocaleString("en-US") : "-" },
              ]}
              metadataRows={metadataRows}
            />
          </div>

          <StickySectionNav showNetwork={showNetworkSection} />
        </div>
      </section>
    </div>
  );
}
