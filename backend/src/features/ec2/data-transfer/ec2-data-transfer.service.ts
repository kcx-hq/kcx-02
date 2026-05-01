import type { Ec2DataTransferInput, Ec2DataTransferRawRow, Ec2DataTransferResponse, Ec2DataTransferRow } from "./ec2-data-transfer.types.js";
import { Ec2DataTransferQuery } from "./ec2-data-transfer.query.js";
import {
  classifyDataTransferSignals,
  TRANSFER_TYPE_LABELS,
} from "./ec2-data-transfer.classifier.js";

type WorkingRow = Ec2DataTransferRow & { dateMap: Map<string, { cost: number; usageGb: number }> };

const round2 = (value: number): number => Number((Number.isFinite(value) ? value : 0).toFixed(2));
const SAVINGS_RATE = {
  internet: 0.2,
  inter_region: 0.3,
  inter_az: 0.25,
  unknown: 0.1,
} as const;
const toTransferRecommendation = (input: { transferType: "internet" | "inter_region" | "inter_az" | "unknown"; cost: number; usageGb: number }): { recommendation: string | null; severity: "low" | "medium" | "high" | null } => {
  if (input.transferType === "internet") {
    if (input.cost >= 10 || input.usageGb >= 100) return { recommendation: "Review public traffic, use CDN/caching/compression where applicable.", severity: input.cost >= 50 || input.usageGb >= 500 ? "high" : "medium" };
    return { recommendation: null, severity: null };
  }
  if (input.transferType === "inter_region" && input.cost > 0) return { recommendation: "Co-locate dependent services in the same region where possible.", severity: input.cost >= 25 ? "high" : "medium" };
  if (input.transferType === "inter_az" && input.cost > 0) return { recommendation: "Review cross-AZ communication and placement of chatty services.", severity: input.cost >= 20 ? "high" : "medium" };
  if (input.transferType === "unknown" && input.cost >= 5) return { recommendation: "Review billing usage type and source resource mapping.", severity: input.cost >= 25 ? "medium" : "low" };
  return { recommendation: null, severity: null };
};

const usageToGb = (row: Ec2DataTransferRawRow): number => {
  const billedUsage = Number(row.usageQuantity ?? 0);
  if (!Number.isFinite(billedUsage) || billedUsage <= 0) return 0;
  return billedUsage;
};

const rowKey = (row: {
  resourceId: string | null;
  accountId: string;
  region: string;
  team: string | null;
  product: string | null;
  environment: string | null;
  transferType: string;
}): string => `${row.resourceId ?? "_null_"}::${row.accountId}::${row.region}::${row.team ?? ""}::${row.product ?? ""}::${row.environment ?? ""}::${row.transferType}`;

export class Ec2DataTransferService {
  private readonly query: Ec2DataTransferQuery;

  constructor(query: Ec2DataTransferQuery = new Ec2DataTransferQuery()) {
    this.query = query;
  }

  async getDataTransfer(input: Ec2DataTransferInput): Promise<Ec2DataTransferResponse> {
    const [currentRows, previousRows] = await Promise.all([
      this.query.getLineItems(input),
      this.query.getLineItems({
        ...input,
        startDate: new Date(new Date(`${input.startDate}T00:00:00.000Z`).getTime() - ((new Date(`${input.endDate}T00:00:00.000Z`).getTime() - new Date(`${input.startDate}T00:00:00.000Z`).getTime()) + 24 * 60 * 60 * 1000)).toISOString().slice(0, 10),
        endDate: new Date(new Date(`${input.startDate}T00:00:00.000Z`).getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }),
    ]);

    const previousCostByKey = new Map<string, number>();

    for (const row of previousRows) {
      const classified = classifyDataTransferSignals(row);
      if (!classified.isDataTransferCandidate || classified.isNatGateway) continue;
      const { transferType } = classified;
      const normalized = {
        resourceId: row.resourceId ? row.resourceId.trim() : null,
        accountId: (row.accountId ?? "unknown").trim() || "unknown",
        region: (row.region ?? "unknown").trim() || "unknown",
        team: row.team?.trim() || null,
        product: row.product?.trim() || null,
        environment: row.environment?.trim() || null,
        transferType,
      };
      const key = rowKey(normalized);
      previousCostByKey.set(key, (previousCostByKey.get(key) ?? 0) + Math.max(0, Number(row.cost ?? 0)));
    }

    const grouped = new Map<string, WorkingRow>();

    for (const lineItem of currentRows) {
      const classified = classifyDataTransferSignals(lineItem);
      if (!classified.isDataTransferCandidate || classified.isNatGateway) continue;
      const { transferType, confidence } = classified;
      const usageGb = usageToGb(lineItem);
      const cost = Math.max(0, Number(lineItem.cost ?? 0));
      if (cost <= 0 && usageGb <= 0) continue;

      const normalized = {
        resourceId: lineItem.resourceId ? lineItem.resourceId.trim() : null,
        resourceName: lineItem.resourceName?.trim() || null,
        accountId: (lineItem.accountId ?? "unknown").trim() || "unknown",
        accountName: lineItem.accountName?.trim() || null,
        region: (lineItem.region ?? "unknown").trim() || "unknown",
        team: lineItem.team?.trim() || null,
        product: lineItem.product?.trim() || null,
        environment: lineItem.environment?.trim() || null,
      };

      const key = rowKey({ ...normalized, transferType });
      const existing = grouped.get(key) ?? {
        resourceId: normalized.resourceId,
        resourceName: normalized.resourceName,
        accountId: normalized.accountId,
        accountName: normalized.accountName,
        region: normalized.region,
        team: normalized.team,
        product: normalized.product,
        environment: normalized.environment,
        transferType,
        transferTypeLabel: TRANSFER_TYPE_LABELS[transferType],
        usageGb: 0,
        cost: 0,
        costTrendPct: null,
        firstSeen: lineItem.date,
        lastSeen: lineItem.date,
        recommendation: null,
        recommendationSeverity: null,
        estimatedSavings: 0,
        confidence,
        dateMap: new Map<string, { cost: number; usageGb: number }>(),
      };

      existing.usageGb += usageGb;
      existing.cost += cost;
      existing.firstSeen = existing.firstSeen && existing.firstSeen <= lineItem.date ? existing.firstSeen : lineItem.date;
      existing.lastSeen = existing.lastSeen && existing.lastSeen >= lineItem.date ? existing.lastSeen : lineItem.date;
      const dateAgg = existing.dateMap.get(lineItem.date) ?? { cost: 0, usageGb: 0 };
      dateAgg.cost += cost;
      dateAgg.usageGb += usageGb;
      existing.dateMap.set(lineItem.date, dateAgg);
      grouped.set(key, existing);
    }

    let rows = [...grouped.values()];

    rows = rows.filter((row) => {
      if (input.accountId && row.accountId !== input.accountId) return false;
      if (input.region && row.region !== input.region) return false;
      if (input.team && (row.team ?? "") !== input.team) return false;
      if (input.product && (row.product ?? "") !== input.product) return false;
      if (input.environment && (row.environment ?? "") !== input.environment) return false;
      if (input.transferType && row.transferType !== input.transferType) return false;
      return true;
    });

    rows = rows.map((row) => {
      const key = rowKey(row);
      const previousCost = previousCostByKey.get(key) ?? 0;
      const costTrendPct = previousCost > 0 ? ((row.cost - previousCost) / previousCost) * 100 : null;
      const rec = toTransferRecommendation({ transferType: row.transferType, cost: row.cost, usageGb: row.usageGb });
      const estimatedSavings = row.cost * SAVINGS_RATE[row.transferType];
      return {
        ...row,
        usageGb: round2(row.usageGb),
        cost: round2(row.cost),
        costTrendPct: costTrendPct === null ? null : round2(costTrendPct),
        estimatedSavings: round2(estimatedSavings),
        recommendation: rec.recommendation,
        recommendationSeverity: rec.severity,
      };
    });

    const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
    const totalUsageGb = rows.reduce((sum, row) => sum + row.usageGb, 0);

    const costByType = {
      internet: rows.filter((row) => row.transferType === "internet").reduce((sum, row) => sum + row.cost, 0),
      inter_region: rows.filter((row) => row.transferType === "inter_region").reduce((sum, row) => sum + row.cost, 0),
      inter_az: rows.filter((row) => row.transferType === "inter_az").reduce((sum, row) => sum + row.cost, 0),
      unknown: rows.filter((row) => row.transferType === "unknown").reduce((sum, row) => sum + row.cost, 0),
    };

    const usageByType = {
      internet: rows.filter((row) => row.transferType === "internet").reduce((sum, row) => sum + row.usageGb, 0),
      inter_region: rows.filter((row) => row.transferType === "inter_region").reduce((sum, row) => sum + row.usageGb, 0),
      inter_az: rows.filter((row) => row.transferType === "inter_az").reduce((sum, row) => sum + row.usageGb, 0),
      unknown: rows.filter((row) => row.transferType === "unknown").reduce((sum, row) => sum + row.usageGb, 0),
    };

    const breakdown = (["internet", "inter_region", "inter_az", "unknown"] as const).map((transferType) => {
      const scopedRows = rows.filter((row) => row.transferType === transferType);
      return {
        transferType,
        label: TRANSFER_TYPE_LABELS[transferType],
        cost: round2(costByType[transferType]),
        usageGb: round2(usageByType[transferType]),
        percentageOfDataTransferCost: round2(totalCost > 0 ? (costByType[transferType] / totalCost) * 100 : 0),
        resourceCount: new Set(scopedRows.map((row) => row.resourceId).filter((item): item is string => Boolean(item))).size,
        recommendationCount: scopedRows.filter((row) => Boolean(row.recommendation)).length,
      };
    });

    const trendMap = new Map<string, { internetCost: number; interRegionCost: number; interAzCost: number; unknownCost: number; usageGb: number }>();
    for (const raw of rows) {
      const working = grouped.get(rowKey(raw));
      if (!working) continue;
      for (const [date, value] of working.dateMap.entries()) {
        const existing = trendMap.get(date) ?? { internetCost: 0, interRegionCost: 0, interAzCost: 0, unknownCost: 0, usageGb: 0 };
        if (raw.transferType === "internet") existing.internetCost += value.cost;
        if (raw.transferType === "inter_region") existing.interRegionCost += value.cost;
        if (raw.transferType === "inter_az") existing.interAzCost += value.cost;
        if (raw.transferType === "unknown") existing.unknownCost += value.cost;
        existing.usageGb += value.usageGb;
        trendMap.set(date, existing);
      }
    }

    const trend = [...trendMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({
        date,
        internetCost: round2(value.internetCost),
        interRegionCost: round2(value.interRegionCost),
        interAzCost: round2(value.interAzCost),
        unknownCost: round2(value.unknownCost),
        totalCost: round2(value.internetCost + value.interRegionCost + value.interAzCost + value.unknownCost),
        usageGb: round2(value.usageGb),
      }));

    return {
      summary: {
        totalCost: round2(totalCost),
        totalUsageGb: round2(totalUsageGb),
        resourceCount: new Set(rows.map((row) => row.resourceId).filter((item): item is string => Boolean(item))).size,
        internetCost: round2(costByType.internet),
        interRegionCost: round2(costByType.inter_region),
        interAzCost: round2(costByType.inter_az),
        unknownCost: round2(costByType.unknown),
        potentialSavings: round2(
          costByType.internet * SAVINGS_RATE.internet +
            costByType.inter_region * SAVINGS_RATE.inter_region +
            costByType.inter_az * SAVINGS_RATE.inter_az +
            costByType.unknown * SAVINGS_RATE.unknown,
        ),
      },
      breakdown,
      trend,
    };
  }
}
