import type { Ec2CostExplorerRawRow } from "../ec2-cost-explorer.types.js";
import { toCostTypeKey } from "./cost-classification.js";

const round = (value: number): number => Number((Number.isFinite(value) ? value : 0).toFixed(2));
const normalizeInstanceId = (value: string | null | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  if (normalized.length === 0) return null;
  if (normalized.toLowerCase() === "unknown") return null;
  return normalized;
};

export const buildKpis = (rows: Ec2CostExplorerRawRow[]) => {
  const instances = new Set<string>();
  let grossCost = 0;
  let credits = 0;
  let netCost = 0;
  let computeCost = 0;
  for (const row of rows) {
    grossCost += row.grossCost;
    credits += row.credits;
    if (toCostTypeKey(row.category) === "compute") computeCost += row.grossCost;
    const instanceId = normalizeInstanceId(row.instanceId);
    if (instanceId) instances.add(instanceId);
  }
  netCost = grossCost - credits;
  return {
    grossCost: round(grossCost),
    credits: round(credits),
    netCost: round(netCost),
    computeCost: round(computeCost),
    instanceCount: instances.size,
  };
};
