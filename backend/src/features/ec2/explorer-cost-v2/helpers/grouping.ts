import type {
  Ec2CostExplorerGroupBy,
  Ec2CostExplorerRawRow,
  Ec2CostExplorerTableRow,
} from "../ec2-cost-explorer.types.js";
import { dominantCostDriver, toCostTypeKey } from "./cost-classification.js";
import { normalizeRegion, normalizeReservationType, normalizeUnknown, toTagValue } from "./normalization.js";

const round = (value: number): number => Number((Number.isFinite(value) ? value : 0).toFixed(2));
const normalizeInstanceId = (value: string | null | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  if (normalized.length === 0) return null;
  if (normalized.toLowerCase() === "unknown") return null;
  return normalized;
};
const isInvalidGroupValue = (value: string | null | undefined): boolean => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized.length === 0 || normalized === "unknown" || normalized === "null" || normalized === "undefined";
};

export const groupOfRow = (
  row: Ec2CostExplorerRawRow,
  groupBy: Ec2CostExplorerGroupBy,
  tagKey: string | null,
): { groupKey: string; groupLabel: string } => {
  if (groupBy === "none") return { groupKey: "total", groupLabel: "Total" };
  if (groupBy === "account") return normalizeUnknown(row.account);
  if (groupBy === "region") return normalizeRegion(row.region);
  if (groupBy === "instance") {
    const label = String(row.instanceName ?? "").trim() || String(row.instanceId ?? "").trim();
    if (!label || label.toLowerCase() === "unknown") return { groupKey: "unknown", groupLabel: "Unknown" };
    const id = String(row.instanceId ?? label).trim() || label;
    return { groupKey: id, groupLabel: label };
  }
  if (groupBy === "instance_type") return normalizeUnknown(row.instanceType);
  if (groupBy === "cost_type") {
    const key = toCostTypeKey(row.category);
    if (key === "data_transfer") return { groupKey: "data_transfer", groupLabel: "Data Transfer" };
    if (key === "elastic_ip") return { groupKey: "elastic_ip", groupLabel: "Elastic IP" };
    if (key === "volume") return { groupKey: "volume", groupLabel: "Volume" };
    if (key === "snapshot") return { groupKey: "snapshot", groupLabel: "Snapshot" };
    if (key === "compute") return { groupKey: "compute", groupLabel: "Compute" };
    return { groupKey: "other", groupLabel: "Other" };
  }
  if (groupBy === "reservation_type") return normalizeReservationType(row.reservationType);
  if (groupBy === "tag") return normalizeUnknown(toTagValue(row.tagsJson, tagKey));
  return { groupKey: "total", groupLabel: "Total" };
};

export const buildTableRows = (
  rows: Ec2CostExplorerRawRow[],
  groupBy: Ec2CostExplorerGroupBy,
  tagKey: string | null,
  _selectedCostBasis: "gross_cost" | "net_cost" | "effective_cost" | "amortized_cost",
  compare: "none" | "previous_period",
): Ec2CostExplorerTableRow[] => {
  const bucket = new Map<string, Ec2CostExplorerTableRow>();
  const instancesByGroup = new Map<string, Set<string>>();
  const totalGrossCost = rows.reduce((sum, row) => sum + row.grossCost, 0);

  for (const row of rows) {
    const group = groupOfRow(row, groupBy, tagKey);
    const key = `${group.groupKey}::${group.groupLabel}`;
    const current = bucket.get(key) ?? {
      groupKey: group.groupKey,
      groupLabel: group.groupLabel,
      grossCost: 0,
      netCost: 0,
      effectiveCost: 0,
      computeCost: 0,
      volumeCost: 0,
      snapshotCost: 0,
      dataTransferCost: 0,
      elasticIpCost: 0,
      otherCost: 0,
      instanceCount: 0,
      percentOfTotal: 0,
      mainCostDriver: "Other",
    };

    current.grossCost += row.grossCost;
    current.netCost += row.grossCost;
    current.effectiveCost += row.effectiveCost;

    const category = toCostTypeKey(row.category);
    if (category === "compute") current.computeCost += row.grossCost;
    else if (category === "volume") current.volumeCost += row.grossCost;
    else if (category === "snapshot") current.snapshotCost += row.grossCost;
    else if (category === "data_transfer") current.dataTransferCost += row.grossCost;
    else if (category === "elastic_ip") current.elasticIpCost += row.grossCost;
    else current.otherCost += row.grossCost;

    bucket.set(key, current);

    const instanceKey = normalizeInstanceId(row.instanceId);
    if (instanceKey) {
      const set = instancesByGroup.get(key) ?? new Set<string>();
      set.add(instanceKey);
      instancesByGroup.set(key, set);
    }
  }

  const out = [...bucket.entries()].map(([key, row]) => {
    const count = instancesByGroup.get(key)?.size ?? 0;
    row.instanceCount = count;
    row.percentOfTotal = totalGrossCost > 0 ? round((row.grossCost / totalGrossCost) * 100) : 0;
    row.mainCostDriver = dominantCostDriver({
      computeCost: row.computeCost,
      volumeCost: row.volumeCost,
      snapshotCost: row.snapshotCost,
      dataTransferCost: row.dataTransferCost,
      elasticIpCost: row.elasticIpCost,
      otherCost: row.otherCost,
    });
    row.grossCost = round(row.grossCost);
    row.netCost = round(row.netCost);
    row.effectiveCost = round(row.effectiveCost);
    row.computeCost = round(row.computeCost);
    row.volumeCost = round(row.volumeCost);
    row.snapshotCost = round(row.snapshotCost);
    row.dataTransferCost = round(row.dataTransferCost);
    row.elasticIpCost = round(row.elasticIpCost);
    row.otherCost = round(row.otherCost);
    return row;
  });

  const sanitized = out.filter((row) => {
    if (groupBy === "none" || groupBy === "cost_type") return true;
    return !isInvalidGroupValue(row.groupKey) && !isInvalidGroupValue(row.groupLabel);
  });
  const filtered = compare === "none"
    ? sanitized.filter((row) => !(row.grossCost === 0 && row.instanceCount === 0))
    : sanitized;

  return filtered.sort((a, b) => b.grossCost - a.grossCost);
};
