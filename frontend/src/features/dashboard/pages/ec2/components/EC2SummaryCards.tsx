import { compactCurrencyFormatter, percentFormatter } from "../../cost-explorer/costExplorer.utils";

type EC2SummaryCardsProps = {
  loading?: boolean;
  metric?: "cost" | "usage" | "instances" | "volumes" | "data-transfer";
  summary: {
    totalCost: number;
    previousCost: number;
    trendPercent: number;
    instanceCount: number;
    volumeCount?: number;
    attachedInstanceCount?: number;
    unattachedVolumeCount?: number;
    storageGb?: number;
    storageGbHours?: number;
    avgCpu: number;
    totalNetworkGb: number;
  };
};

export function EC2SummaryCards({ summary, loading = false, metric = "cost" }: EC2SummaryCardsProps) {
  const trendClass =
    summary.trendPercent > 0 ? "is-negative" : summary.trendPercent < 0 ? "is-positive" : "is-neutral";

  const baseCards = [
    { label: metric === "volumes" ? "EBS Volume Cost" : "Total Cost", value: compactCurrencyFormatter.format(summary.totalCost) },
    { label: "Previous Cost", value: compactCurrencyFormatter.format(summary.previousCost) },
    {
      label: "Trend",
      value: `${summary.trendPercent >= 0 ? "+" : ""}${percentFormatter.format(summary.trendPercent)}%`,
      tone: trendClass,
    },
  ];

  const cards =
    metric === "data-transfer"
      ? [
          { label: "Data Transfer Cost", value: compactCurrencyFormatter.format(summary.totalCost) },
          { label: "Previous Cost", value: compactCurrencyFormatter.format(summary.previousCost) },
          {
            label: "Trend",
            value: `${summary.trendPercent >= 0 ? "+" : ""}${percentFormatter.format(summary.trendPercent)}%`,
            tone: trendClass,
          },
          { label: "Total Usage (GB)", value: `${(summary.storageGb ?? 0).toLocaleString()} GB` },
          { label: "Resource Count", value: summary.instanceCount.toLocaleString() },
        ]
      : metric === "volumes"
      ? [
          ...baseCards,
          { label: "Volumes", value: (summary.volumeCount ?? 0).toLocaleString() },
          { label: "Attached Instances", value: (summary.attachedInstanceCount ?? summary.instanceCount).toLocaleString() },
          { label: "Unattached Volumes", value: (summary.unattachedVolumeCount ?? 0).toLocaleString() },
          { label: "Storage GB", value: `${(summary.storageGb ?? 0).toLocaleString()} GB` },
          { label: "Storage GB-Hours", value: `${(summary.storageGbHours ?? 0).toLocaleString()} GB-Hrs` },
        ]
      : [
          ...baseCards,
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
