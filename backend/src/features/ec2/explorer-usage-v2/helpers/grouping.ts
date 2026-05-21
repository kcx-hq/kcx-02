import type {
  Ec2UsageExplorerGroupBy,
  Ec2UsageExplorerRawRow,
  Ec2UsageExplorerTableRow,
} from "../ec2-usage-explorer.types.js";
import { normalizeTagValue, normalizeUnknown } from "./normalization.js";

const round = (value: number): number => Number((Number.isFinite(value) ? value : 0).toFixed(4));

export const groupOfRow = (
  row: Ec2UsageExplorerRawRow,
  groupBy: Ec2UsageExplorerGroupBy,
  tagKey: string | null,
): { groupKey: string; groupLabel: string } => {
  if (groupBy === "none") return { groupKey: "total", groupLabel: "Total" };
  if (groupBy === "account") return normalizeUnknown(row.account);
  if (groupBy === "region") return normalizeUnknown(row.region);
  if (groupBy === "instance") return normalizeUnknown(row.instanceName || row.instanceId);
  if (groupBy === "instance_type") return normalizeUnknown(row.instanceType);
  if (groupBy === "tag") return normalizeTagValue(row.tagsJson, tagKey);
  return { groupKey: "total", groupLabel: "Total" };
};

export const buildTableRows = (
  rows: Ec2UsageExplorerRawRow[],
  groupBy: Ec2UsageExplorerGroupBy,
  tagKey: string | null,
): Ec2UsageExplorerTableRow[] => {
  const bucket = new Map<string, Ec2UsageExplorerTableRow>();
  const instancesByGroup = new Map<string, Set<string>>();
  const countsByGroup = new Map<string, number>();

  for (const row of rows) {
    const group = groupOfRow(row, groupBy, tagKey);
    const key = `${group.groupKey}::${group.groupLabel}`;
    const current = bucket.get(key) ?? {
      groupKey: group.groupKey,
      groupLabel: group.groupLabel,
      avgCpu: 0,
      maxCpu: 0,
      networkInGb: 0,
      networkOutGb: 0,
      networkTotalGb: 0,
      instanceCount: 0,
    };

    current.avgCpu += row.avgCpu;
    current.maxCpu = Math.max(current.maxCpu, row.maxCpu);
    current.networkInGb += row.networkInGb;
    current.networkOutGb += row.networkOutGb;
    current.networkTotalGb += row.networkInGb + row.networkOutGb;
    bucket.set(key, current);
    countsByGroup.set(key, (countsByGroup.get(key) ?? 0) + 1);

    const id = String(row.instanceId ?? "").trim();
    if (id) {
      const set = instancesByGroup.get(key) ?? new Set<string>();
      set.add(id);
      instancesByGroup.set(key, set);
    }
  }

  return [...bucket.entries()]
    .map(([key, row]) => {
      const rowCount = countsByGroup.get(key) ?? 0;
      row.avgCpu = rowCount > 0 ? round(row.avgCpu / rowCount) : 0;
      row.maxCpu = round(row.maxCpu);
      row.networkInGb = round(row.networkInGb);
      row.networkOutGb = round(row.networkOutGb);
      row.networkTotalGb = round(row.networkTotalGb);
      row.instanceCount = instancesByGroup.get(key)?.size ?? 0;
      return row;
    })
    .sort((a, b) => b.networkTotalGb - a.networkTotalGb);
};

