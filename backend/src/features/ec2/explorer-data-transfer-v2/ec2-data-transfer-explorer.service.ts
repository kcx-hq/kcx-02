import { TRANSFER_TYPE_LABELS } from "../classification/data-transfer-classifier.js";
import type {
  Ec2DataTransferExplorerGranularity,
  Ec2DataTransferExplorerGroupBy,
  Ec2DataTransferExplorerInput,
  Ec2DataTransferExplorerRawRow,
  Ec2DataTransferExplorerResponse,
} from "./ec2-data-transfer-explorer.types.js";
import { Ec2DataTransferExplorerQuery } from "./ec2-data-transfer-explorer.query.js";

const round = (value: number): number => Number((Number.isFinite(value) ? value : 0).toFixed(4));

const startOfWeekIso = (dateIso: string): string => {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
};

const bucketByGranularity = (dateIso: string, granularity: Ec2DataTransferExplorerGranularity): string => {
  if (granularity === "monthly") return `${dateIso.slice(0, 7)}-01`;
  if (granularity === "weekly") return startOfWeekIso(dateIso);
  return dateIso;
};

const normalizeUnknown = (value: string | null | undefined): { groupKey: string; groupLabel: string } => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return { groupKey: "unknown", groupLabel: "Unknown" };
  return { groupKey: normalized, groupLabel: normalized };
};

const groupOfRow = (row: Ec2DataTransferExplorerRawRow, groupBy: Ec2DataTransferExplorerGroupBy, tagKey: string | null): { groupKey: string; groupLabel: string } => {
  if (groupBy === "none") return { groupKey: "total", groupLabel: "Total" };
  if (groupBy === "account") return normalizeUnknown(row.account);
  if (groupBy === "region") return normalizeUnknown(row.region);
  if (groupBy === "instance") return normalizeUnknown(row.instanceName || row.instanceId);
  if (groupBy === "transfer_type") return { groupKey: row.transferType, groupLabel: TRANSFER_TYPE_LABELS[row.transferType] };
  if (groupBy === "tag") {
    const key = String(tagKey ?? "").trim();
    if (!key) return { groupKey: "unknown", groupLabel: "Unknown" };
    const tagMap = (row.tagsJson ?? {}) as Record<string, unknown>;
    const hit = Object.entries(tagMap).find(([k]) => k.trim().toLowerCase() === key.toLowerCase());
    return normalizeUnknown(hit ? String(hit[1] ?? "") : "Unknown");
  }
  return { groupKey: "total", groupLabel: "Total" };
};

export class Ec2DataTransferExplorerService {
  private query = new Ec2DataTransferExplorerQuery();

  async getDataTransferExplorer(input: Ec2DataTransferExplorerInput): Promise<Ec2DataTransferExplorerResponse> {
    const rows = await this.query.getRows(input);
    const transferRows = input.filters.transferTypes.length > 0
      ? rows.filter((row) => input.filters.transferTypes.includes(row.transferType))
      : rows;

    const rawCostSum = transferRows.reduce((sum, row) => sum + Math.max(0, Number(row.cost ?? 0)), 0);
    const rawUsageSum = transferRows.reduce((sum, row) => sum + Math.max(0, Number(row.usageGb ?? 0)), 0);
    console.debug("[EC2 Data Transfer Explorer V2][Source Debug]", {
      sourceTable: "fact_cost_line_items",
      chargeCategory: "derived_by_classifier",
      transferRowsCount: transferRows.length,
      billedCostSum: round(rawCostSum),
      usageQuantitySum: round(rawUsageSum),
      selectedYAxis: input.yAxis,
      selectedView: input.yAxis === "usage_gb" ? "usage" : "transfer_cost",
    });

    const totalTransferCost = transferRows.reduce((sum, row) => sum + row.cost, 0);
    const totalUsageGb = transferRows.reduce((sum, row) => sum + row.usageGb, 0);
    const internetTransferCost = transferRows.reduce((sum, row) => sum + row.internetCost, 0);
    const interRegionInterAzTransferCost = transferRows.reduce((sum, row) => sum + row.interRegionCost + row.interAzCost, 0);
    const internetUsageGb = transferRows
      .filter((row) => row.transferType === "internet")
      .reduce((sum, row) => sum + row.usageGb, 0);
    const regionalUsageGb = transferRows
      .filter((row) => row.transferType === "inter_region" || row.transferType === "inter_az" || row.transferType === "regional")
      .reduce((sum, row) => sum + row.usageGb, 0);
    const metricTotal = input.yAxis === "usage_gb" ? totalUsageGb : totalTransferCost;

    type GroupAggregate = {
      groupKey: string;
      groupLabel: string;
      transferCost: number;
      usageGb: number;
      internetCost: number;
      interRegionCost: number;
      interAzCost: number;
      regionalCost: number;
      unknownCost: number;
      pointsByDate: Map<string, number>;
      metricTotal: number;
    };

    const grouped = new Map<string, GroupAggregate>();
    for (const row of transferRows) {
      const group = groupOfRow(row, input.groupBy, input.tagKey);
      const key = `${group.groupKey}::${group.groupLabel}`;
      const date = bucketByGranularity(row.date, input.granularity);
      const metricValue = input.yAxis === "usage_gb" ? row.usageGb : row.cost;
      const current = grouped.get(key) ?? {
        groupKey: group.groupKey,
        groupLabel: group.groupLabel,
        transferCost: 0,
        usageGb: 0,
        internetCost: 0,
        interRegionCost: 0,
        interAzCost: 0,
        regionalCost: 0,
        unknownCost: 0,
        pointsByDate: new Map<string, number>(),
        metricTotal: 0,
      };
      current.transferCost += row.cost;
      current.usageGb += row.usageGb;
      current.internetCost += row.internetCost;
      current.interRegionCost += row.interRegionCost;
      current.interAzCost += row.interAzCost;
      current.regionalCost += row.regionalCost;
      current.unknownCost += row.unknownCost;
      current.metricTotal += metricValue;
      current.pointsByDate.set(date, (current.pointsByDate.get(date) ?? 0) + metricValue);
      grouped.set(key, current);
    }

    const tableRows = [...grouped.values()]
      .map((row) => {
        const drivers = [
          { key: "Internet", value: row.internetCost },
          { key: "Inter-Region", value: row.interRegionCost },
          { key: "Inter-AZ", value: row.interAzCost },
          { key: "Regional", value: row.regionalCost },
          { key: "Unknown", value: row.unknownCost },
        ] as const;
        const mainDriver = [...drivers].sort((a, b) => b.value - a.value)[0]?.key ?? "Unknown";
        const percentOfTotal = metricTotal > 0 ? (row.metricTotal / metricTotal) * 100 : 0;
        return {
          groupKey: row.groupKey,
          groupLabel: row.groupLabel,
          transferCost: round(row.transferCost),
          usageGb: round(row.usageGb),
          internetCost: round(row.internetCost),
          interRegionCost: round(row.interRegionCost),
          interAzCost: round(row.interAzCost),
          regionalCost: round(row.regionalCost),
          unknownCost: round(row.unknownCost),
          percentOfTransferCost: round(percentOfTotal),
          mainDriver,
        };
      })
      .sort((a, b) => {
        if (input.yAxis === "usage_gb") return b.usageGb - a.usageGb;
        return b.transferCost - a.transferCost;
      });

    const allDates = [...new Set([...grouped.values()].flatMap((group) => [...group.pointsByDate.keys()]))].sort();
    const series = [...grouped.values()]
      .map((group) => ({
        groupKey: group.groupKey,
        groupLabel: group.groupLabel,
        points: allDates.map((date) => ({
          date,
          value: round(group.pointsByDate.get(date) ?? 0),
        })),
      }))
      .filter((group) => group.points.some((point) => point.value > 0))
      .sort((a, b) => {
        const totalA = a.points.reduce((sum, point) => sum + point.value, 0);
        const totalB = b.points.reduce((sum, point) => sum + point.value, 0);
        return totalB - totalA;
      });

    return {
      kpis: {
        transferCost: round(totalTransferCost),
        usageGb: round(totalUsageGb),
        internetTransferCost: round(input.yAxis === "usage_gb" ? internetUsageGb : internetTransferCost),
        interRegionInterAzTransferCost: round(input.yAxis === "usage_gb" ? regionalUsageGb : interRegionInterAzTransferCost),
      },
      chart: {
        granularity: input.granularity,
        xAxis: "date",
        yAxis: input.yAxis,
        series,
      },
      table: {
        rows: tableRows,
      },
      meta: {
        yAxis: input.yAxis,
        groupBy: input.groupBy,
        granularity: input.granularity,
        compare: input.compare,
        currency: "USD",
        normalized: true,
      },
    };
  }
}
