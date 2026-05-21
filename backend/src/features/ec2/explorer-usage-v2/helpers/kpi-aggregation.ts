import type { Ec2UsageExplorerRawRow } from "../ec2-usage-explorer.types.js";

const round = (value: number): number => Number((Number.isFinite(value) ? value : 0).toFixed(4));

export const buildKpis = (rows: Ec2UsageExplorerRawRow[]) => {
  const instances = new Set<string>();
  let avgCpuSum = 0;
  let maxCpu = 0;
  let totalNetworkInGb = 0;
  let totalNetworkOutGb = 0;
  for (const row of rows) {
    avgCpuSum += row.avgCpu;
    maxCpu = Math.max(maxCpu, row.maxCpu);
    totalNetworkInGb += row.networkInGb;
    totalNetworkOutGb += row.networkOutGb;
    const id = String(row.instanceId ?? "").trim();
    if (id) instances.add(id);
  }
  return {
    avgCpu: rows.length > 0 ? round(avgCpuSum / rows.length) : 0,
    maxCpu: round(maxCpu),
    totalNetworkInGb: round(totalNetworkInGb),
    totalNetworkOutGb: round(totalNetworkOutGb),
    instanceCount: instances.size,
  };
};

