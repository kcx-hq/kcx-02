import type {
  Ec2CostExplorerChartSeries,
  Ec2CostExplorerCostBasis,
  Ec2CostExplorerGranularity,
  Ec2CostExplorerGroupBy,
  Ec2CostExplorerRawRow,
} from "../ec2-cost-explorer.types.js";
import { groupOfRow } from "./grouping.js";
import { toCostTypeKey } from "./cost-classification.js";

const round = (value: number): number => Number((Number.isFinite(value) ? value : 0).toFixed(2));

const startOfWeekIso = (dateIso: string): string => {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
};

export const bucketByGranularity = (dateIso: string, granularity: Ec2CostExplorerGranularity): string => {
  if (granularity === "monthly") return `${dateIso.slice(0, 7)}-01`;
  if (granularity === "weekly") return startOfWeekIso(dateIso);
  return dateIso;
};

const chartValue = (row: Ec2CostExplorerRawRow): number => {
  const costType = toCostTypeKey(row.category);
  if (costType === "other" && row.credits > 0) return 0;
  return row.grossCost > 0 ? row.grossCost : 0;
};

export const buildChartSeries = (
  rows: Ec2CostExplorerRawRow[],
  granularity: Ec2CostExplorerGranularity,
  groupBy: Ec2CostExplorerGroupBy,
  tagKey: string | null,
  _basis: Ec2CostExplorerCostBasis,
  compare: "none" | "previous_period",
): Ec2CostExplorerChartSeries[] => {
  const byDate = new Map<string, Map<string, { key: string; label: string; value: number }>>();
  const totalsByGroup = new Map<string, number>();
  for (const row of rows) {
    const date = bucketByGranularity(row.date, granularity);
    const group = groupOfRow(row, groupBy, tagKey);
    const groupMap = byDate.get(date) ?? new Map<string, { key: string; label: string; value: number }>();
    const current = groupMap.get(group.groupKey) ?? { key: group.groupKey, label: group.groupLabel, value: 0 };
    current.value += chartValue(row);
    groupMap.set(group.groupKey, current);
    byDate.set(date, groupMap);
    totalsByGroup.set(group.groupKey, (totalsByGroup.get(group.groupKey) ?? 0) + chartValue(row));
  }

  const dates = [...byDate.keys()].sort();
  const groups = [...new Set([...byDate.values()].flatMap((map) => [...map.keys()]))];
  const series = groups.map((groupKey) => {
    const any = byDate.values().next().value?.get(groupKey) as { label?: string } | undefined;
    const label = any?.label ?? groupKey;
    return {
      groupKey,
      groupLabel: label,
      points: dates.map((date) => {
        const value = byDate.get(date)?.get(groupKey)?.value ?? 0;
        return { date, value: round(value) };
      }),
    };
  });

  const filtered = compare === "none" ? series.filter((s) => (totalsByGroup.get(s.groupKey) ?? 0) > 0) : series;
  return filtered.sort((a, b) => (totalsByGroup.get(b.groupKey) ?? 0) - (totalsByGroup.get(a.groupKey) ?? 0));
};
