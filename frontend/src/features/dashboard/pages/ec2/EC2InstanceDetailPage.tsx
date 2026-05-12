import { useEffect, useMemo, useState } from "react";
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
  StorageSection,
  networkBreakdownColorAt,
  splitBullets,
  volumeColumnsFactory,
  type DecisionStatus,
} from "./components/EC2InstanceDetailDecisionLayout";
import { formatRecommendationEvidence } from "./components/recommendationEvidence";
import { dashboardApi, type Ec2RecommendationStatus } from "../../api/dashboardApi";
import { useDashboardScope } from "../../hooks/useDashboardScope";

const VOLUMES_PAGE_PATH = "/dashboard/inventory/aws/ec2/volumes";
const INSTANCES_PAGE_PATH = "/dashboard/inventory/aws/ec2/instances";
const OPTIMIZATION_PAGE_PATH = "/dashboard/ec2/optimization";

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const NETWORK_TYPES = new Set(["high_internet_data_transfer", "high_inter_az_data_transfer", "high_inter_region_data_transfer", "high_nat_gateway_cost", "low_cpu_high_network", "unattached_elastic_ip"]);
const COMPUTE_TYPES = new Set(["idle_instance", "underutilized_instance", "overutilized_instance", "uncovered_on_demand", "low_cpu_high_network"]);
const STORAGE_TYPES = new Set(["unattached_volume", "old_snapshot", "storage_heavy_instance"]);

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);
const getDefaultDateRange = (): { start: string; end: string } => {
  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return { start: toIsoDate(startOfMonth), end: toIsoDate(today) };
};

const toTitle = (value: string): string => value.replaceAll("_", " ").replaceAll("-", " ").split(" ").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
const formatCurrency = (value: number | null | undefined): string => value === null || typeof value === "undefined" || !Number.isFinite(value) ? "$0.00" : CURRENCY_FORMATTER.format(value);
const formatPercent = (value: number | null | undefined): string => value === null || typeof value === "undefined" || !Number.isFinite(value) ? "0.00%" : `${DECIMAL_FORMATTER.format(value)}%`;
const formatNumber = (value: number | null | undefined): string => value === null || typeof value === "undefined" || !Number.isFinite(value) ? "0.00" : DECIMAL_FORMATTER.format(value);
const formatSize = (value: number | null | undefined): string => value === null || typeof value === "undefined" || !Number.isFinite(value) ? "-" : `${value.toLocaleString()} GB`;
const bytesToGb = (value: number | null | undefined): number => value === null || typeof value === "undefined" || !Number.isFinite(value) ? 0 : value / (1024 * 1024 * 1024);

const toUsageUnit = (gb: number): string => gb >= 1024 ? `${formatNumber(gb / 1024)} TB` : `${formatNumber(gb)} GB`;

const toPricingLabel = (value: "on_demand" | "reserved" | "savings_plan" | "spot" | "other" | null): string => {
  if (value === "on_demand") return "On-Demand";
  if (value === "reserved") return "RI";
  if (value === "savings_plan") return "SP";
  if (value === "spot") return "Spot";
  if (value === "other") return "Other";
  return "—";
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
  return found ? String(found[1]) : "—";
};

const rankRisk = (risk: string): number => {
  const normalized = risk.toLowerCase();
  if (normalized === "critical") return 4;
  if (normalized === "high") return 3;
  if (normalized === "medium") return 2;
  if (normalized === "low") return 1;
  return 0;
};

const getIssueFamily = (type: string): "network" | "compute" | "storage" | "other" => {
  if (NETWORK_TYPES.has(type)) return "network";
  if (COMPUTE_TYPES.has(type)) return "compute";
  if (STORAGE_TYPES.has(type)) return "storage";
  return "other";
};

export default function EC2InstanceDetailPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const defaults = getDefaultDateRange();
  const startDate = queryParams.get("startDate") ?? queryParams.get("from") ?? queryParams.get("billingPeriodStart") ?? defaults.start;
  const endDate = queryParams.get("endDate") ?? queryParams.get("to") ?? queryParams.get("billingPeriodEnd") ?? defaults.end;
  const cloudConnectionId = queryParams.get("cloudConnectionId") ?? queryParams.get("cloud_connection_id");
  const focusParam = (queryParams.get("focus") ?? "").toLowerCase();
  const issueParam = queryParams.get("issue") ?? "";
  const recommendationIdParam = queryParams.get("recommendationId") ?? "";
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const { scope } = useDashboardScope();
  const [statusOverrides, setStatusOverrides] = useState<Record<number, string>>({});
  const [pendingStatusId, setPendingStatusId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const detailQuery = useInventoryEc2InstanceDetail({ instanceId: instanceId ?? "", cloudConnectionId, startDate, endDate });

  const backToInstances = () => {
    const next = new URLSearchParams(location.search);
    next.delete("instanceId");
    navigate({ pathname: INSTANCES_PAGE_PATH, search: next.toString() });
  };

  const isExpanded = (id: string): boolean => expandedSections[id] ?? false;
  const setExpanded = (id: string, next: boolean) => setExpandedSections((prev) => ({ ...prev, [id]: next }));
  const openAndScroll = (id: string) => {
    setExpanded(id, true);
    setTimeout(() => {
      const element = document.getElementById(id);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      element.classList.add("ec2-instance-detail__panel--focus");
      window.setTimeout(() => element.classList.remove("ec2-instance-detail__panel--focus"), 2600);
    }, 80);
  };

  useEffect(() => {
    if (!detailQuery.data) return;
    const recommendations = detailQuery.data.recommendations ?? [];
    const hasRecommendations = recommendations.length > 0;
    const primaryType = recommendations[0]?.type ?? "";
    const family = getIssueFamily(primaryType);
    const hasNetworkSection = (detailQuery.data.networkInsight?.totalNetworkCost ?? 0) > 0 || (detailQuery.data.networkInsight?.breakdown?.length ?? 0) > 0 || family === "network";

    const defaults: Record<string, boolean> = hasRecommendations ? { actions: true } : { signals: true };
    if (hasRecommendations && family === "network" && hasNetworkSection) defaults.network = true;
    if (hasRecommendations && family === "compute") defaults.performance = true;
    if (hasRecommendations && family === "storage") defaults.storage = true;

    setExpandedSections((prev) => ({ ...defaults, ...prev }));
  }, [detailQuery.data?.identity.instanceId]);

  useEffect(() => {
    if (!detailQuery.data) return;
    const targetId =
      focusParam === "network" ? "network"
        : focusParam === "actions" ? "actions"
          : focusParam === "performance" ? "performance"
            : focusParam === "storage" ? "storage"
              : focusParam === "pricing" ? "cost-drivers"
                : "summary";
    if (targetId !== "summary") openAndScroll(targetId);
    if (recommendationIdParam) setExpanded("actions", true);
  }, [focusParam, recommendationIdParam, detailQuery.data?.identity.instanceId]);

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

  const canonicalNetworkCost = [detail.networkInsight.totalNetworkCost, detail.costSummary.networkCost, detail.usageSummary.networkCost].find((value) => Number.isFinite(value)) ?? 0;
  const totalCost = Number.isFinite(detail.costSummary.totalCost) ? detail.costSummary.totalCost : 0;
  const computeCost = Number.isFinite(detail.costSummary.computeCost) ? detail.costSummary.computeCost : 0;
  const ebsCost = Number.isFinite(detail.costSummary.ebsCost) ? detail.costSummary.ebsCost : 0;
  const otherCost = Math.max(totalCost - computeCost - ebsCost - canonicalNetworkCost, 0);

  const costRows = [
    { type: "Compute", cost: computeCost },
    { type: "EBS / Volume", cost: ebsCost },
    { type: "Network", cost: canonicalNetworkCost },
    { type: "Other", cost: otherCost },
  ].map((row) => ({ ...row, pct: totalCost > 0 ? (row.cost / totalCost) * 100 : 0 }));

  const severityRank = (value: string | null | undefined): number => {
    const normalized = (value ?? "").toLowerCase();
    if (normalized === "critical") return 5;
    if (normalized === "high") return 4;
    if (normalized === "medium") return 3;
    if (normalized === "low") return 2;
    if (normalized === "informational") return 1;
    return 0;
  };

  const sortedRecommendations = [...detail.recommendations]
    .map((recommendation) => ({ ...recommendation, status: statusOverrides[recommendation.id] ?? recommendation.status }))
    .sort((a, b) => {
    const bySavings = (b.saving ?? 0) - (a.saving ?? 0);
    if (bySavings !== 0) return bySavings;
    const bySeverity = severityRank(b.severity) - severityRank(a.severity);
    if (bySeverity !== 0) return bySeverity;
    const byDetectedAt = new Date(b.detectedAt ?? b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.detectedAt ?? a.updatedAt ?? a.createdAt ?? 0).getTime();
    if (byDetectedAt !== 0) return byDetectedAt;
      return b.id - a.id;
    });
  const handleStatusChange = async (
    recommendation: (typeof sortedRecommendations)[number],
    nextStatus: Ec2RecommendationStatus,
  ) => {
    if (!scope) return;
    const previousStatus = statusOverrides[recommendation.id] ?? recommendation.status;
    const reason = (nextStatus === "dismissed" || nextStatus === "completed")
      ? window.prompt("Optional reason/note", "")?.trim() || null
      : null;
    let snoozed_until: string | null = null;
    if (nextStatus === "snoozed") {
      const preset = window.prompt("Snooze: type 7, 30, or YYYY-MM-DD", "7")?.trim() ?? "";
      if (!preset) return;
      if (preset === "7" || preset === "30") {
        const date = new Date();
        date.setDate(date.getDate() + Number(preset));
        snoozed_until = date.toISOString().slice(0, 10);
      } else {
        snoozed_until = preset;
      }
    }
    setPendingStatusId(recommendation.id);
    setStatusOverrides((current) => ({ ...current, [recommendation.id]: nextStatus }));
    try {
      await dashboardApi.updateEc2RecommendationStatus(scope, recommendation.id, { status: nextStatus, reason, snoozed_until });
      setActionMessage("Recommendation updated");
      await detailQuery.refetch();
    } catch {
      setStatusOverrides((current) => ({ ...current, [recommendation.id]: previousStatus }));
      setActionMessage("Failed to update recommendation");
    } finally {
      setPendingStatusId(null);
      window.setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const primaryRecommendation = sortedRecommendations[0];
  const hasRecommendations = sortedRecommendations.length > 0;
  const totalSavings = sortedRecommendations.reduce((sum, rec) => sum + (rec.saving ?? 0), 0);
  const status: DecisionStatus = sortedRecommendations.some((rec) => rankRisk(rec.risk) >= 3) ? "Risk Detected" : hasRecommendations ? "Optimization Opportunity" : "Healthy";

  const selectedIssueType = issueParam || primaryRecommendation?.type || "";
  const issueFamily = getIssueFamily(selectedIssueType || primaryRecommendation?.type || "");

  const networkBreakdownRows = [...(detail.networkInsight.breakdown ?? [])].filter((item) => item.cost > 0 || item.usageGb > 0).sort((a, b) => b.cost - a.cost);
  const hasNetworkBreakdown = networkBreakdownRows.length > 0;

  const lookupNetwork = (pattern: RegExp) => networkBreakdownRows.find((row) => pattern.test(row.type.toLowerCase()));
  const internetRow = lookupNetwork(/internet|egress/);
  const interAzRow = lookupNetwork(/inter[- ]?az|cross[- ]?az/);
  const interRegionRow = lookupNetwork(/inter[- ]?region|regional|cross[- ]?region/);
  const natRow = lookupNetwork(/nat/);

  const normalizedNetworkRows = [
    { type: "Internet Data Transfer", cost: internetRow?.cost ?? 0, usageGb: internetRow?.usageGb ?? 0, percentage: canonicalNetworkCost > 0 ? ((internetRow?.cost ?? 0) / canonicalNetworkCost) * 100 : 0, reason: "Public internet egress/ingress charges from transfer paths." },
    { type: "Inter-AZ Data Transfer", cost: interAzRow?.cost ?? 0, usageGb: interAzRow?.usageGb ?? 0, percentage: canonicalNetworkCost > 0 ? ((interAzRow?.cost ?? 0) / canonicalNetworkCost) * 100 : 0, reason: "Cross-availability-zone traffic between services and dependencies." },
    { type: "Inter-Region / Regional Data Transfer", cost: interRegionRow?.cost ?? 0, usageGb: interRegionRow?.usageGb ?? 0, percentage: canonicalNetworkCost > 0 ? ((interRegionRow?.cost ?? 0) / canonicalNetworkCost) * 100 : 0, reason: "Traffic crossing region boundaries or regional transfer pathways." },
    {
      type: "Other Network / Unknown",
      cost: Math.max(canonicalNetworkCost - (internetRow?.cost ?? 0) - (interAzRow?.cost ?? 0) - (interRegionRow?.cost ?? 0), 0),
      usageGb: Math.max(detail.networkInsight.totalNetworkUsageGb - (internetRow?.usageGb ?? 0) - (interAzRow?.usageGb ?? 0) - (interRegionRow?.usageGb ?? 0), 0),
      percentage: 0,
      reason: natRow ? "Includes NAT Gateway and uncategorized transfer entries." : "Needs backend source classification for remaining transfer cost.",
    },
  ].map((row) => ({ ...row, percentage: canonicalNetworkCost > 0 ? (row.cost / canonicalNetworkCost) * 100 : 0 }));

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
      data: normalizedNetworkRows.map((row, index) => ({ name: row.type, value: row.cost, itemStyle: { color: networkBreakdownColorAt(index) } })),
    }],
  };

  const issueDescription = (() => {
    const type = selectedIssueType || primaryRecommendation?.type;
    if (type === "high_internet_data_transfer") return "This instance sends most of its network traffic to the internet, increasing data transfer cost.";
    if (type === "high_inter_az_data_transfer") return "This instance has high cross-AZ traffic, which can inflate transfer charges.";
    if (type === "high_inter_region_data_transfer") return "This instance has high cross-region traffic, increasing network transfer cost.";
    if (type === "high_nat_gateway_cost") return "NAT Gateway transfer processing is a significant cost component for this instance.";
    return primaryRecommendation?.problem ?? "No active optimization opportunity found for this instance.";
  })();
  const primaryEvidence = formatRecommendationEvidence(primaryRecommendation?.evidence);
  const primaryAction = primaryRecommendation?.action ?? "No action required.";
  const riskLevel = primaryRecommendation ? toTitle(primaryRecommendation.risk) : "Low";

  const heroMetrics = hasRecommendations ? [
    { label: "Total Cost", value: formatCurrency(totalCost) },
    { label: "Network Cost", value: formatCurrency(canonicalNetworkCost) },
    { label: "Internet Data Transfer Cost", value: formatCurrency(internetRow?.cost ?? 0) },
    { label: "Internet Data Transfer Usage", value: toUsageUnit(internetRow?.usageGb ?? 0) },
    { label: "Potential Savings", value: `${formatCurrency(totalSavings)}/month` },
    { label: "Risk Level", value: riskLevel },
  ] : [
    { label: "Total Cost", value: formatCurrency(totalCost) },
    { label: "Network Cost", value: formatCurrency(canonicalNetworkCost) },
    { label: "Potential Savings", value: "$0.00/month" },
    { label: "Risk Level", value: "Low" },
  ];

  const dominantRow = [...costRows].sort((a, b) => b.cost - a.cost)[0] ?? { type: "Other", cost: 0, pct: 0 };
  const showNetworkSection = issueFamily === "network" || canonicalNetworkCost > 0 || hasNetworkBreakdown;

  const dominantNetworkInsight = (() => {
    const type = selectedIssueType || primaryRecommendation?.type;
    if (type === "high_internet_data_transfer") return "Internet data transfer is the primary network cost driver for this instance.";
    if (type === "high_inter_az_data_transfer") return "Cross-AZ traffic may indicate chatty services spread across availability zones.";
    if (type === "high_inter_region_data_transfer") return "Cross-region traffic may indicate workloads or dependencies running far apart.";
    if (type === "high_nat_gateway_cost") return "NAT Gateway traffic may be reduced with VPC endpoints or private connectivity.";
    if (type === "low_cpu_high_network") return "CPU is low but network usage is high, suggesting this instance may be acting as a data transfer or proxy workload.";
    return null;
  })();

  const whatToCheck = (() => {
    const type = selectedIssueType || primaryRecommendation?.type;
    if (type === "high_internet_data_transfer") return ["External APIs", "Public file serving", "Large response payloads", "Missing CDN/cache"];
    if (type === "high_inter_az_data_transfer") return ["Service placement across AZs", "Load balancer cross-zone behavior", "Chatty microservice communication"];
    if (type === "high_inter_region_data_transfer") return ["Cross-region replication", "Remote database/service calls", "Region placement of dependent services"];
    if (type === "high_nat_gateway_cost") return ["NAT egress paths", "VPC endpoints availability", "Private connectivity routes"];
    return [];
  })();

  const performanceInsight = (() => {
    const type = selectedIssueType || primaryRecommendation?.type;
    if (type === "idle_instance" || type === "underutilized_instance") return "CPU is consistently low while the instance continues to incur cost.";
    if (type === "overutilized_instance") return "CPU is high and may indicate overutilization.";
    if (type === "low_cpu_high_network") return "CPU is low but network usage is high, suggesting this instance may be acting as a data transfer or proxy workload.";
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

  const highlightedRecommendation = recommendationIdParam
    ? sortedRecommendations.find((rec) => String(rec.id) === recommendationIdParam)
    : undefined;
  const actionsToRender = highlightedRecommendation
    ? [highlightedRecommendation, ...sortedRecommendations.filter((rec) => rec.id !== highlightedRecommendation.id).slice(0, 2)]
    : sortedRecommendations.slice(0, 3);
  const showViewAll = sortedRecommendations.length > 3;

  const sections = [
    { id: "summary", label: "Summary" },
    { id: "actions", label: "Actions" },
    { id: "signals", label: "Key Signals" },
    { id: "cost-drivers", label: "Cost Drivers" },
    ...(showNetworkSection ? [{ id: "network", label: "Network Evidence" }] : []),
    { id: "performance", label: "Performance" },
    { id: "storage", label: "Storage" },
    { id: "metadata", label: "Metadata" },
  ];


  const investigateLabel =
    issueFamily === "network" ? "Investigate Network"
      : issueFamily === "compute" ? "Investigate Performance"
        : issueFamily === "storage" ? "Investigate Storage"
          : "Investigate";

  const openActionCenter = (params?: { category?: string; issueType?: string; recommendationId?: number }) => {
    if (!instanceId) return;
    const next = new URLSearchParams(location.search);
    next.set("resourceId", instanceId);
    if (params?.category) next.set("category", params.category);
    if (params?.issueType) next.set("issueType", params.issueType);
    if (params?.recommendationId) next.set("recommendationId", String(params.recommendationId));
    navigate({ pathname: OPTIMIZATION_PAGE_PATH, search: next.toString() });
  };

  const evidenceFirstSection = issueFamily === "network" ? "network" : issueFamily === "storage" ? "storage" : "performance";

  return (
    <div className="dashboard-page">
      <section className="ec2-instance-detail" aria-label="EC2 instance detail">
        <div className="ec2-instance-detail__layout">
          <div className="ec2-instance-detail__content">
            <DecisionSummaryCard
              status={status}
              issueTitle={hasRecommendations ? recommendationTypeLabel(selectedIssueType || primaryRecommendation.type) : "No Active Optimization Opportunity"}
              issueDescription={issueDescription}
              riskLevel={riskLevel}
              metrics={heroMetrics}
              primaryEvidence={primaryEvidence.length > 0 ? primaryEvidence : [{ label: "Evidence", value: "Needs backend source" }]}
              primaryAction={primaryAction}
              showOpportunity={hasRecommendations}
              onViewActions={() => openAndScroll("actions")}
              investigateLabel={investigateLabel}
              onInvestigate={() => openAndScroll(evidenceFirstSection)}
              onOpenActionCenter={() => primaryRecommendation ? openActionCenter({ category: primaryRecommendation.category, issueType: primaryRecommendation.type, recommendationId: primaryRecommendation.id }) : openActionCenter()}
            />

            <section id="actions" className="ec2-instance-detail__panel ec2-instance-detail__accordion">
              <button type="button" aria-expanded={isExpanded("actions")} className="ec2-instance-detail__accordion-head" onClick={() => setExpanded("actions", !isExpanded("actions"))}><h3>Recommended Actions</h3><span>{`Recommended Actions · ${sortedRecommendations.length} open · ${formatCurrency(totalSavings)}/mo savings`}</span></button>
              {isExpanded("actions") ? (!hasRecommendations ? <p className="dashboard-note">No optimization opportunities found for this instance.</p> : (
                <>
                  <div className="ec2-instance-detail__recommendation-grid">
                    {actionsToRender.map((rec) => (
                      <RecommendationCard
                        key={rec.id}
                        recommendation={rec}
                        isHighlighted={String(rec.id) === recommendationIdParam}
                        formatCurrency={formatCurrency}
                        toTitle={toTitle}
                        recommendationTypeLabel={recommendationTypeLabel}
                        evidenceBullets={formatRecommendationEvidence(rec.evidence)}
                        actionBullets={splitBullets(rec.action)}
                        onActionClick={(item) => openActionCenter({ category: item.category, issueType: item.type, recommendationId: item.id })}
                        onStatusChange={handleStatusChange}
                        isStatusUpdating={pendingStatusId === rec.id}
                      />
                    ))}
                  </div>
                  {actionMessage ? <p className="dashboard-note">{actionMessage}</p> : null}
                  {showViewAll ? <button type="button" className="cost-explorer-state-btn" onClick={() => openActionCenter({ issueType: selectedIssueType })}>View all recommendations</button> : null}
                </>
              )) : null}
            </section>

            <section id="signals" className="ec2-instance-detail__panel ec2-instance-detail__accordion">
              <button type="button" aria-expanded={isExpanded("signals")} className="ec2-instance-detail__accordion-head" onClick={() => setExpanded("signals", !isExpanded("signals"))}><h3>Key Signals</h3><span>{`Key Signals · Total ${formatCurrency(totalCost)} · CPU ${formatPercent(detail.usageSummary.avgCpu)} · Network ${formatCurrency(canonicalNetworkCost)}`}</span></button>
              {isExpanded("signals") ? <KeySignalsGrid items={[{ label: "Total Cost", value: formatCurrency(totalCost) }, { label: "Compute Cost", value: formatCurrency(computeCost) }, { label: "Volume Cost", value: formatCurrency(ebsCost) }, { label: "Network Cost", value: formatCurrency(canonicalNetworkCost) }, { label: "Avg CPU", value: formatPercent(detail.usageSummary.avgCpu) }, { label: "Network Usage", value: toUsageUnit(bytesToGb(detail.usageSummary.networkUsageBytes)) }, { label: "Pricing Type", value: toPricingLabel(detail.pricingSummary.pricingType) }, { label: "State", value: detail.identity.state ? toTitle(detail.identity.state.toLowerCase()) : "—" }]} /> : null}
            </section>

            <section id="cost-drivers" className="ec2-instance-detail__panel ec2-instance-detail__accordion">
              <button type="button" aria-expanded={isExpanded("cost-drivers")} className="ec2-instance-detail__accordion-head" onClick={() => setExpanded("cost-drivers", !isExpanded("cost-drivers"))}><h3>Cost Drivers</h3><span>{`Cost Drivers · ${dominantRow.type} dominates · ${formatPercent(dominantRow.pct)}`}</span></button>
              {isExpanded("cost-drivers") ? <CostDriversSection costRows={costRows} totalCost={formatCurrency(totalCost)} dominantLabel={dominantRow.type} dominantPct={formatPercent(dominantRow.pct)} formatCurrency={formatCurrency} formatPercent={formatPercent} /> : null}
            </section>

            {showNetworkSection ? <section id="network" className="ec2-instance-detail__panel ec2-instance-detail__accordion"><button type="button" aria-expanded={isExpanded("network")} className="ec2-instance-detail__accordion-head" onClick={() => setExpanded("network", !isExpanded("network"))}><h3>Network Evidence</h3><span>{`Network Evidence · Internet ${formatPercent((internetRow?.cost ?? 0) > 0 ? ((internetRow?.cost ?? 0) / Math.max(canonicalNetworkCost, 1)) * 100 : 0)} · ${formatCurrency(canonicalNetworkCost)} network cost`}</span></button>{isExpanded("network") ? <NetworkDetailsSection totalCost={formatCurrency(canonicalNetworkCost)} totalUsage={toUsageUnit(detail.networkInsight.totalNetworkUsageGb)} internetCost={formatCurrency(internetRow?.cost ?? 0)} internetUsage={toUsageUnit(internetRow?.usageGb ?? 0)} interAzCost={formatCurrency(interAzRow?.cost ?? 0)} interAzUsage={toUsageUnit(interAzRow?.usageGb ?? 0)} rows={normalizedNetworkRows} chartOption={networkChart} dominantInsight={dominantNetworkInsight} whatToCheck={whatToCheck} hasBreakdown={hasNetworkBreakdown} formatCurrency={formatCurrency} formatPercent={formatPercent} formatNumber={formatNumber} /> : null}</section> : null}

            <section id="performance" className="ec2-instance-detail__panel ec2-instance-detail__accordion">
              <button type="button" aria-expanded={isExpanded("performance")} className="ec2-instance-detail__accordion-head" onClick={() => setExpanded("performance", !isExpanded("performance"))}><h3>Performance</h3><span>{`Performance · Avg CPU ${formatPercent(detail.usageSummary.avgCpu)} · Network ${toUsageUnit(bytesToGb(detail.usageSummary.networkUsageBytes))}`}</span></button>
              {isExpanded("performance") ? <PerformanceSection avgCpu={formatPercent(detail.usageSummary.avgCpu)} maxCpu={formatPercent(detail.usageSummary.maxCpu)} networkIn={toUsageUnit(bytesToGb(detail.usageSummary.networkInBytes))} networkOut={toUsageUnit(bytesToGb(detail.usageSummary.networkOutBytes))} cpuOption={usageCpuOption} networkOption={usageNetworkOption} hasCpuTrend={detail.trends.cpuTrend.length > 0} hasNetworkTrend={detail.trends.networkTrend.length > 0} insight={performanceInsight} /> : null}
            </section>

            <section id="storage" className="ec2-instance-detail__panel ec2-instance-detail__accordion">
              <button type="button" aria-expanded={isExpanded("storage")} className="ec2-instance-detail__accordion-head" onClick={() => setExpanded("storage", !isExpanded("storage"))}><h3>Storage</h3><span>{`Storage · ${detail.attachedVolumes.length} volume${detail.attachedVolumes.length === 1 ? "" : "s"} · ${formatCurrency(ebsCost)}`}</span></button>
              {isExpanded("storage") ? <StorageSection attachedVolumes={detail.attachedVolumes} storageColumns={storageColumns} showDominantBanner={dominantRow.type === "EBS / Volume"} onVolumeRowClick={(row) => { const next = new URLSearchParams(location.search); next.set("volumeId", row.volumeId); next.set("search", row.volumeId); navigate({ pathname: `${VOLUMES_PAGE_PATH}/${row.volumeId}`, search: next.toString() }); }} /> : null}
            </section>

            <section id="metadata" className="ec2-instance-detail__panel ec2-instance-detail__accordion">
              <button type="button" aria-expanded={isExpanded("metadata")} className="ec2-instance-detail__accordion-head" onClick={() => setExpanded("metadata", !isExpanded("metadata"))}><h3>Metadata</h3><span>{`Metadata · ${detail.identity.region ?? "—"} · ${detail.identity.type ?? "—"} · ${detail.identity.state ? toTitle(detail.identity.state.toLowerCase()) : "—"}`}</span></button>
              {isExpanded("metadata") ? <MetadataSection values={[{ label: "Instance ID", value: detail.identity.instanceId ?? "—" }, { label: "Region", value: detail.identity.region ?? "—" }, { label: "Account", value: detail.identity.account ?? "—" }, { label: "Availability Zone", value: detail.identity.availabilityZone ?? "—" }, { label: "Launch Time", value: detail.identity.launchTime ? new Date(detail.identity.launchTime).toLocaleString("en-US") : "—" }, { label: "Instance Type", value: detail.identity.type ?? "—" }, { label: "State", value: detail.identity.state ? toTitle(detail.identity.state.toLowerCase()) : "—" }, { label: "Team", value: getTagValue(tags, "Team") }, { label: "Product", value: getTagValue(tags, "Product") }, { label: "Environment", value: getTagValue(tags, "Environment") }, { label: "Owner", value: getTagValue(tags, "Owner") }]} metadataRows={metadataRows} /> : null}
            </section>
          </div>

          <StickySectionNav sections={sections} onNavigate={openAndScroll} />
        </div>
      </section>
    </div>
  );
}

