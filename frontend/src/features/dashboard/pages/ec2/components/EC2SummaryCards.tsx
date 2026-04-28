import { compactCurrencyFormatter, percentFormatter } from "../../cost-explorer/costExplorer.utils";

type EC2SummaryCardsProps = {
  loading?: boolean;
  summary: {
    totalCost: number;
    previousCost: number;
    trendPercent: number;
    instanceCount: number;
    avgCpu: number;
    totalNetworkGb: number;
  };
};

export function EC2SummaryCards({ summary, loading = false }: EC2SummaryCardsProps) {
  const trendClass =
    summary.trendPercent > 0 ? "is-negative" : summary.trendPercent < 0 ? "is-positive" : "is-neutral";

  const cards = [
    { label: "Total Cost", value: compactCurrencyFormatter.format(summary.totalCost) },
    { label: "Previous Cost", value: compactCurrencyFormatter.format(summary.previousCost) },
    {
      label: "Trend",
      value: `${summary.trendPercent >= 0 ? "+" : ""}${percentFormatter.format(summary.trendPercent)}%`,
      tone: trendClass,
    },
    { label: "Instances", value: summary.instanceCount.toLocaleString() },
    { label: "Avg CPU", value: `${summary.avgCpu.toFixed(1)}%` },
    { label: "Network", value: `${summary.totalNetworkGb.toFixed(1)} GB` },
  ];

  return (
    <section className="ec2-explorer-summary" aria-label="EC2 explorer summary cards">
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
