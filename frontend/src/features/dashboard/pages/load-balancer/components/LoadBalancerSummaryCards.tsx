import type { LoadBalancerMetric, LoadBalancerUsageType } from "../loadBalancerExplorer.types";

type Summary = {
  totalCost: number;
  fixedCost?: number;
  lcuCost?: number;
  dataProcessingCost?: number;
  previousCost: number;
  trendPercent: number;
  loadBalancerCount: number;
  totalLoadBalancers?: number;
  albCount?: number;
  nlbCount?: number;
  internetFacingCount: number;
  internalCount: number;
  requestCount?: number;
  processedGB?: number;
  activeConnections?: number;
  newConnections?: number;
  healthyHosts?: number;
  unhealthyHosts?: number;
  errorCount?: number;
};

type Props = {
  metric: LoadBalancerMetric;
  usageType: LoadBalancerUsageType;
  summary: Summary;
  usageDailyStats?: {
    averagePerDay: number;
    peakPerDay: number;
  };
  loading?: boolean;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const formatUsageValue = (usageType: LoadBalancerUsageType, value: number): string => {
  const numeric = Number.isFinite(value) ? value : 0;
  const digits =
    usageType === "processed_gb" || usageType === "healthy_hosts" || usageType === "unhealthy_hosts" ? 2 : 0;
  return numeric.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const usageMetricLabel = (usageType: LoadBalancerUsageType): string => {
  if (usageType === "processed_gb") return "GB";
  if (usageType === "active_connections") return "Active Connections";
  if (usageType === "new_connections") return "New Connections";
  if (usageType === "healthy_hosts") return "Healthy Hosts";
  if (usageType === "unhealthy_hosts") return "Unhealthy Hosts";
  if (usageType === "errors") return "Errors";
  return "Requests";
};

const usageTotal = (summary: Summary, usageType: LoadBalancerUsageType): number => {
  if (usageType === "processed_gb") return Number(summary.processedGB ?? 0);
  if (usageType === "active_connections") return Number(summary.activeConnections ?? 0);
  if (usageType === "new_connections") return Number(summary.newConnections ?? 0);
  if (usageType === "healthy_hosts") return Number(summary.healthyHosts ?? 0);
  if (usageType === "unhealthy_hosts") return Number(summary.unhealthyHosts ?? 0);
  if (usageType === "errors") return Number(summary.errorCount ?? 0);
  return Number(summary.requestCount ?? 0);
};

export function LoadBalancerSummaryCards({ metric, usageType, summary, usageDailyStats, loading = false }: Props) {
  const trendClass =
    summary.trendPercent > 0 ? "is-negative" : summary.trendPercent < 0 ? "is-positive" : "is-neutral";

  const cards =
    metric === "cost"
      ? [
          { label: "Total Cost", value: currency.format(summary.totalCost) },
          { label: "Fixed Cost", value: currency.format(summary.fixedCost ?? 0) },
          { label: "LCU Cost", value: currency.format(summary.lcuCost ?? 0) },
          { label: "Data Processing Cost", value: currency.format(summary.dataProcessingCost ?? 0) },
          { label: "Load Balancer Count", value: (summary.loadBalancerCount ?? 0).toLocaleString() },
          {
            label: "Trend",
            value: `${summary.trendPercent >= 0 ? "+" : ""}${percent.format(summary.trendPercent)}%`,
            tone: trendClass,
          },
        ]
      : metric === "load_balancers"
        ? [
          { label: "Total Load Balancers", value: (summary.totalLoadBalancers ?? summary.loadBalancerCount ?? 0).toLocaleString() },
          { label: "ALB Count", value: (summary.albCount ?? 0).toLocaleString() },
          { label: "NLB Count", value: (summary.nlbCount ?? 0).toLocaleString() },
          { label: "Internet Facing Count", value: (summary.internetFacingCount ?? 0).toLocaleString() },
          { label: "Internal Count", value: (summary.internalCount ?? 0).toLocaleString() },
          ]
        : (() => {
            const label = usageMetricLabel(usageType);
            const total = usageTotal(summary, usageType);
            const avgPerDay = Number(usageDailyStats?.averagePerDay ?? 0);
            const peakPerDay = Number(usageDailyStats?.peakPerDay ?? 0);
            return [
              { label: `Total ${label}`, value: formatUsageValue(usageType, total) },
              { label: `Avg ${label}/Day`, value: formatUsageValue(usageType, avgPerDay) },
              { label: `Peak ${label}/Day`, value: formatUsageValue(usageType, peakPerDay) },
            ];
          })();

  return (
    <section
      className={`ec2-explorer-summary load-balancer-explorer-summary${metric === "load_balancers" ? " load-balancer-explorer-summary--inventory" : ""}`}
      aria-label="Load balancer explorer summary cards"
    >
      {cards.map((card) => (
        <article
          key={card.label}
          className={`ec2-explorer-summary__card${card.tone ? ` ${card.tone}` : ""}${loading ? " is-loading" : ""}`}
        >
          <p className="ec2-explorer-summary__label">{card.label}</p>
          <p className="ec2-explorer-summary__value">{loading ? "..." : card.value}</p>
        </article>
      ))}
    </section>
  );
}
