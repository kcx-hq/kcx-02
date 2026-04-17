import { enumerateDateRange } from "./dateRange.js";
import type {
  AnomalyRecord,
  BillingSourceOption,
  CloudCostReportQuery,
  DailyServiceCostRecord,
} from "./report.types.js";

const SERVICES = ["EC2", "RDS", "S3", "EKS", "CloudFront"] as const;

const BILLING_SOURCES: BillingSourceOption[] = [
  { id: 1, name: "AWS Production" },
  { id: 2, name: "AWS Staging" },
  { id: 3, name: "Shared Services" },
];

const BASE_SERVICE_COST: Record<(typeof SERVICES)[number], number> = {
  EC2: 290,
  RDS: 160,
  S3: 95,
  EKS: 130,
  CloudFront: 85,
};

function seededRatio(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function getServiceCostForDate(date: string, service: (typeof SERVICES)[number], billingSourceId: number): number {
  const utcDate = new Date(`${date}T00:00:00.000Z`);
  const dayOfMonth = Number(date.slice(8, 10));
  const dayOfWeek = utcDate.getUTCDay();
  const seasonality = 1 + Math.sin(dayOfMonth / 4) * 0.06;
  const weeklyFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.92 : 1.04;
  const sourceFactor = billingSourceId === 1 ? 1.18 : billingSourceId === 2 ? 0.72 : 0.48;
  const noise = 0.95 + seededRatio(`${date}:${service}:${billingSourceId}`) * 0.12;

  let spikeFactor = 1;
  if (date === "2026-03-12" && service === "EC2") {
    spikeFactor = 2.22;
  }
  if (date === "2026-03-21" && service === "RDS") {
    spikeFactor = 1.42;
  }
  if (date === "2026-03-28" && service === "S3") {
    spikeFactor = 1.31;
  }

  const baseline = BASE_SERVICE_COST[service];
  const value = baseline * seasonality * weeklyFactor * sourceFactor * noise * spikeFactor;
  return roundTo(value, 2);
}

export class CloudCostReportRepository {
  async getBillingSources(): Promise<BillingSourceOption[]> {
    return BILLING_SOURCES;
  }

  async getDailyServiceCosts(query: CloudCostReportQuery): Promise<DailyServiceCostRecord[]> {
    const dates = enumerateDateRange(query.startDate, query.endDate);
    const sourceIds = query.billingSourceId ? [query.billingSourceId] : BILLING_SOURCES.map((item) => item.id);

    const rows: DailyServiceCostRecord[] = [];
    for (const date of dates) {
      for (const sourceId of sourceIds) {
        for (const service of SERVICES) {
          rows.push({
            date,
            service,
            cost: getServiceCostForDate(date, service, sourceId),
            billingSourceId: sourceId,
          });
        }
      }
    }

    return rows;
  }

  async getAnomalies(query: CloudCostReportQuery): Promise<AnomalyRecord[]> {
    const sourceIds = query.billingSourceId ? [query.billingSourceId] : BILLING_SOURCES.map((item) => item.id);
    const dates = new Set(enumerateDateRange(query.startDate, query.endDate));

    const candidates: Array<Omit<AnomalyRecord, "billingSourceId"> & { date: string }> = [
      { date: "2026-03-12", service: "EC2", actualCost: 1560, expectedCost: 690 },
      { date: "2026-03-21", service: "RDS", actualCost: 730, expectedCost: 425 },
      { date: "2026-03-28", service: "S3", actualCost: 510, expectedCost: 360 },
    ];

    const rows: AnomalyRecord[] = [];
    for (const sourceId of sourceIds) {
      const sourceMultiplier = sourceId === 1 ? 1 : sourceId === 2 ? 0.55 : 0.38;
      for (const candidate of candidates) {
        if (!dates.has(candidate.date)) {
          continue;
        }

        rows.push({
          date: candidate.date,
          service: candidate.service,
          actualCost: roundTo(candidate.actualCost * sourceMultiplier, 2),
          expectedCost: roundTo(candidate.expectedCost * sourceMultiplier, 2),
          billingSourceId: sourceId,
        });
      }
    }

    rows.sort((a, b) => (a.date < b.date ? -1 : 1));
    return rows;
  }
}

