import type {
  Ec2UsageExplorerAggregation,
  Ec2UsageExplorerChartSeries,
  Ec2UsageExplorerGranularity,
  Ec2UsageExplorerGroupBy,
  Ec2UsageExplorerMetric,
  Ec2UsageExplorerRawRow,
} from "../ec2-usage-explorer.types.js";
import { groupOfRow } from "./grouping.js";

const round = (value: number): number => Number((Number.isFinite(value) ? value : 0).toFixed(4));

const startOfWeekIso = (dateIso: string): string => {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
};

const bucketByGranularity = (dateIso: string, granularity: Ec2UsageExplorerGranularity): string => {
  if (granularity === "monthly") return `${dateIso.slice(0, 7)}-01`;
  if (granularity === "weekly") return startOfWeekIso(dateIso);
  return dateIso;
};

const metricValue = (
  row: Ec2UsageExplorerRawRow,
  usageMetric: Ec2UsageExplorerMetric,
  aggregation: Ec2UsageExplorerAggregation,
): number => {
  if (usageMetric === "cpu") return aggregation === "max" ? row.maxCpu : row.avgCpu;
  if (usageMetric === "network_in") return row.networkInGb;
  if (usageMetric === "network_out") return row.networkOutGb;
  return row.networkInGb + row.networkOutGb;
};

export const buildChartSeries = (
  rows: Ec2UsageExplorerRawRow[],
  granularity: Ec2UsageExplorerGranularity,
  groupBy: Ec2UsageExplorerGroupBy,
  tagKey: string | null,
  usageMetric: Ec2UsageExplorerMetric,
  aggregation: Ec2UsageExplorerAggregation,
): Ec2UsageExplorerChartSeries[] => {
  const byDate = new Map<string, Map<string, { key: string; label: string; sum: number; count: number; max: number }>>();
  const totalsByGroup = new Map<string, number>();

  for (const row of rows) {
    const date = bucketByGranularity(row.date, granularity);
    const group = groupOfRow(row, groupBy, tagKey);
    const dateMap = byDate.get(date) ?? new Map<string, { key: string; label: string; sum: number; count: number; max: number }>();
    const current = dateMap.get(group.groupKey) ?? { key: group.groupKey, label: group.groupLabel, sum: 0, count: 0, max: 0 };
    const value = metricValue(row, usageMetric, aggregation);
    current.sum += value;
    current.count += 1;
    current.max = Math.max(current.max, value);
    dateMap.set(group.groupKey, current);
    byDate.set(date, dateMap);
  }

  const dates = [...byDate.keys()].sort();
  const groups = [...new Set([...byDate.values()].flatMap((m) => [...m.keys()]))];
  const valueOf = (item: { sum: number; count: number; max: number }): number =>
    aggregation === "max" ? item.max : aggregation === "sum" ? item.sum : (item.count > 0 ? item.sum / item.count : 0);

  const series = groups.map((groupKey) => ({
    groupKey,
    groupLabel: byDate.values().next().value?.get(groupKey)?.label ?? groupKey,
    points: dates.map((date) => {
      const point = byDate.get(date)?.get(groupKey);
      const value = point ? valueOf(point) : 0;
      totalsByGroup.set(groupKey, (totalsByGroup.get(groupKey) ?? 0) + value);
      return { date, value: round(value) };
    }),
  }));

  return series
    .filter((s) => (totalsByGroup.get(s.groupKey) ?? 0) > 0)
    .sort((a, b) => (totalsByGroup.get(b.groupKey) ?? 0) - (totalsByGroup.get(a.groupKey) ?? 0));
};
