import type { CostTypeKey, Ec2CostExplorerRawRow } from "../ec2-cost-explorer.types.js";
import { normalizeCostType } from "./normalization.js";

export const toCostTypeKey = (category: string): CostTypeKey => normalizeCostType(category).groupKey as CostTypeKey;

export const includeInExplorerModel = (row: Ec2CostExplorerRawRow): boolean => {
  const key = String(row.category ?? "").trim().toLowerCase();
  if (key === "nat_gateway") return false;
  return true;
};

export const dominantCostDriver = (parts: {
  computeCost: number;
  volumeCost: number;
  snapshotCost: number;
  dataTransferCost: number;
  elasticIpCost: number;
  otherCost: number;
}): "Compute" | "Volume" | "Snapshot" | "Data Transfer" | "Elastic IP" | "Other" => {
  const pairs: Array<[string, number]> = [
    ["Compute", parts.computeCost],
    ["Volume", parts.volumeCost],
    ["Snapshot", parts.snapshotCost],
    ["Data Transfer", parts.dataTransferCost],
    ["Elastic IP", parts.elasticIpCost],
    ["Other", parts.otherCost],
  ];
  pairs.sort((a, b) => b[1] - a[1]);
  return (pairs[0]?.[0] as ReturnType<typeof dominantCostDriver>) ?? "Other";
};
