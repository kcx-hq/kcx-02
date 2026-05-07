import type { LoadBalancerMetric } from "../loadBalancerExplorer.types";

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
};

type Props = {
  metric: LoadBalancerMetric;
  summary: Summary;
  loading?: boolean;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function LoadBalancerSummaryCards({ metric, summary, loading = false }: Props) {
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
      : [
          { label: "Total Load Balancers", value: (summary.totalLoadBalancers ?? summary.loadBalancerCount ?? 0).toLocaleString() },
          { label: "ALB Count", value: (summary.albCount ?? 0).toLocaleString() },
          { label: "NLB Count", value: (summary.nlbCount ?? 0).toLocaleString() },
          { label: "Internet Facing Count", value: (summary.internetFacingCount ?? 0).toLocaleString() },
          { label: "Internal Count", value: (summary.internalCount ?? 0).toLocaleString() },
        ];

  return (
    <section className="ec2-explorer-summary" aria-label="Load balancer explorer summary cards">
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

