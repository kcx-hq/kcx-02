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
  ebsCost: number;
  snapshotCost: number;
  dataTransferCost: number;
  eipCost: number;
  otherCost: number;
}): "Compute" | "EBS" | "Snapshot" | "Data Transfer" | "EIP" | "Other" => {
  const pairs: Array<[string, number]> = [
    ["Compute", parts.computeCost],
    ["EBS", parts.ebsCost],
    ["Snapshot", parts.snapshotCost],
    ["Data Transfer", parts.dataTransferCost],
    ["EIP", parts.eipCost],
    ["Other", parts.otherCost],
  ];
  pairs.sort((a, b) => b[1] - a[1]);
  return (pairs[0]?.[0] as ReturnType<typeof dominantCostDriver>) ?? "Other";
};

