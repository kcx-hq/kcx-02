import type { DashboardSectionResponse } from "../overview/overview.service.js";
import {
  formatDisplayPeriod,
  formatIsoDate,
  getPreviousPeriodRange,
} from "./dateRange.js";
import { buildCloudCostInsights } from "./reportInsights.js";
import { CloudCostReportRepository } from "./report.repository.js";
import type {
  CloudCostAnomalyReportResponse,
  CloudCostBreakdownItem,
  CloudCostReportQuery,
  CloudCostTopContributor,
  DailyServiceCostRecord,
} from "./report.types.js";

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function aggregateCostByDate(rows: DailyServiceCostRecord[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.date] = (acc[row.date] ?? 0) + row.cost;
    return acc;
  }, {});
}

function aggregateCostByService(rows: DailyServiceCostRecord[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.service] = (acc[row.service] ?? 0) + row.cost;
    return acc;
  }, {});
}

function toBreakdownItems(serviceTotals: Record<string, number>, totalCost: number): CloudCostBreakdownItem[] {
  const sorted = Object.entries(serviceTotals)
    .map(([service, cost]) => ({ service, cost: roundTo(cost, 2) }))
    .sort((a, b) => b.cost - a.cost);

  if (sorted.length <= 4) {
    return sorted.map((item) => ({
      ...item,
      percentage: totalCost > 0 ? roundTo((item.cost / totalCost) * 100, 2) : 0,
    }));
  }

  const topThree = sorted.slice(0, 3);
  const otherCost = sum(sorted.slice(3).map((item) => item.cost));
  const condensed = [...topThree, { service: "Other", cost: roundTo(otherCost, 2) }];

  return condensed.map((item) => ({
    ...item,
    percentage: totalCost > 0 ? roundTo((item.cost / totalCost) * 100, 2) : 0,
  }));
}

function toTopContributors(
  serviceTotals: Record<string, number>,
  totalCost: number,
): CloudCostTopContributor[] {
  const contributorNameByService: Record<string, string> = {
    EC2: "Prod Compute Cluster",
    RDS: "Transactional Databases",
    S3: "Object Storage Tier",
    EKS: "Kubernetes Platform",
    CloudFront: "Edge Delivery Network",
  };

  return Object.entries(serviceTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([service, value], index) => {
      const allocation = index === 0 ? 0.92 : index === 1 ? 0.87 : 0.81;
      const amount = roundTo(Math.min(value * allocation, totalCost), 2);
      return {
        rank: index + 1,
        name: contributorNameByService[service] ?? service,
        amount,
      };
    });
}

export class CloudCostAnomalyReportService {
  constructor(private readonly repository: CloudCostReportRepository = new CloudCostReportRepository()) {}

  async getReport(query: CloudCostReportQuery): Promise<CloudCostAnomalyReportResponse> {
    const [currentRows, anomalies, billingSources] = await Promise.all([
      this.repository.getDailyServiceCosts(query),
      this.repository.getAnomalies(query),
      this.repository.getBillingSources(),
    ]);

    const previousPeriod = getPreviousPeriodRange(query);
    const previousRows = await this.repository.getDailyServiceCosts({
      ...query,
      ...previousPeriod,
    });

    const currentTotal = roundTo(sum(currentRows.map((item) => item.cost)), 2);
    const previousTotal = roundTo(sum(previousRows.map((item) => item.cost)), 2);
    const costChangePercentage =
      previousTotal > 0 ? roundTo(((currentTotal - previousTotal) / previousTotal) * 100, 2) : 0;

    const trendByDate = aggregateCostByDate(currentRows);
    const trendData = Object.entries(trendByDate)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, cost]) => ({
        date,
        cost: roundTo(cost, 2),
      }));

    const serviceTotals = aggregateCostByService(currentRows);
    const breakdownData = toBreakdownItems(serviceTotals, currentTotal);
    const topService = breakdownData[0];
    const topContributors = toTopContributors(serviceTotals, currentTotal);

    const anomalyRows = anomalies
      .map((item) => ({
        date: item.date,
        service: item.service,
        actualCost: roundTo(item.actualCost, 2),
        expectedCost: roundTo(item.expectedCost, 2),
        impact: roundTo(item.actualCost - item.expectedCost, 2),
      }))
      .sort((a, b) => b.impact - a.impact);

    const report: CloudCostAnomalyReportResponse = {
      title: "Cloud Cost & Anomaly Report",
      period: formatDisplayPeriod(query.startDate, query.endDate),
      generatedAt: new Date().toISOString(),
      summary: {
        totalCost: currentTotal,
        costChangePercentage,
        anomalyCount: anomalyRows.length,
        topService: topService?.service ?? "N/A",
        topServicePercentage: topService?.percentage ?? 0,
      },
      trendData,
      breakdownData,
      topContributors,
      anomalies: anomalyRows,
      insights: [],
      billingSources,
    };

    report.insights = buildCloudCostInsights(report);
    return report;
  }

  async getLegacyDashboardSummary(): Promise<DashboardSectionResponse> {
    const now = new Date();
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const periodStart = new Date(periodEnd.getTime() - 29 * 24 * 60 * 60 * 1000);
    const report = await this.getReport({
      startDate: formatIsoDate(periodStart),
      endDate: formatIsoDate(periodEnd),
    });

    return {
      section: "report",
      title: "Report",
      message: "Cloud cost & anomaly report fetched successfully",
      summary: [
        { label: "period", value: report.period },
        { label: "totalCost", value: currencyFormatter.format(report.summary.totalCost) },
        { label: "anomalyCount", value: String(report.summary.anomalyCount) },
      ],
    };
  }
}

