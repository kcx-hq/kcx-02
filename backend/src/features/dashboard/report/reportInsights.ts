import type { CloudCostAnomalyReportResponse } from "./report.types.js";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function buildCloudCostInsights(report: Pick<
  CloudCostAnomalyReportResponse,
  "summary" | "anomalies" | "topContributors" | "breakdownData"
>): string[] {
  const lines: string[] = [];
  const { summary, anomalies, topContributors, breakdownData } = report;

  const trendDirection = summary.costChangePercentage >= 0 ? "increased" : "decreased";
  lines.push(
    `Total cloud spend ${trendDirection} by ${Math.abs(summary.costChangePercentage).toFixed(1)}% period-over-period to ${currency.format(summary.totalCost)}.`,
  );

  if (anomalies.length > 0) {
    const highestImpact = anomalies.reduce((best, current) =>
      current.impact > best.impact ? current : best,
    );
    lines.push(
      `${summary.anomalyCount} anomalies were detected, with the largest impact on ${highestImpact.date} (${highestImpact.service}, +${currency.format(highestImpact.impact)}).`,
    );
  } else {
    lines.push("No material anomalies were detected in the selected period.");
  }

  const primaryContributor = topContributors[0];
  const secondaryService = breakdownData[1];
  if (primaryContributor && secondaryService) {
    lines.push(
      `${summary.topService} remained the dominant cost driver (${summary.topServicePercentage.toFixed(1)}%), while ${secondaryService.service} was the next-largest service category.`,
    );
  } else if (primaryContributor) {
    lines.push(
      `${primaryContributor.name} was the largest single contributor with ${currency.format(primaryContributor.amount)} in attributable cost.`,
    );
  }

  return lines.slice(0, 3);
}

