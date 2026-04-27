import type {
  Ec2ExplorerAdditionalDailyCosts,
  Ec2CostBasis,
  Ec2ExplorerFactRow,
  Ec2ExplorerGraph,
  Ec2ExplorerGraphSeries,
  Ec2ExplorerInput,
  Ec2ExplorerResponse,
  Ec2ExplorerSummary,
  Ec2ExplorerTable,
  Ec2ExplorerTableColumn,
  Ec2ExplorerTableRow,
} from "./ec2-explorer.types.js";
import { Ec2ExplorerQuery } from "./ec2-explorer.query.js";

const NETWORK_DIVISOR_GB = 1024 * 1024 * 1024;
const COST_COMPONENTS = [
  "compute",
  "ebs",
  "snapshot",
  "data_transfer",
  "eip",
  "other",
] as const;

const toFixedNumber = (value: number, digits = 2): number =>
  Number((Number.isFinite(value) ? value : 0).toFixed(digits));

const dateRangeDaysInclusive = (startDate: string, endDate: string): number => {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
};

const shiftDate = (dateIso: string, dayDelta: number): string => {
  const current = new Date(`${dateIso}T00:00:00.000Z`);
  current.setUTCDate(current.getUTCDate() + dayDelta);
  return current.toISOString().slice(0, 10);
};

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank] ?? 0;
};

const tagValueForKey = (tags: Record<string, unknown> | null, key: string | null): string => {
  if (!tags || !key) return "Unspecified";
  const direct = tags[key];
  if (typeof direct === "string" && direct.trim().length > 0) return direct.trim();
  const fallback = Object.entries(tags).find(([tagKey]) => tagKey.toLowerCase() === key.toLowerCase());
  if (!fallback) return "Unspecified";
  const value = fallback[1];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "Unspecified";
};

type CostParts = Record<(typeof COST_COMPONENTS)[number], number>;

const toCostParts = (
  row: Ec2ExplorerFactRow,
  additionalByDate: Map<string, Ec2ExplorerAdditionalDailyCosts>,
  selectedCostBasis: Ec2CostBasis = "effective_cost",
): CostParts => {
  const additional = additionalByDate.get(row.date);
  const snapshotCost = additional?.snapshotCost ?? 0;
  const eipCost = additional?.eipCost ?? 0;
  const known = row.computeCost + row.ebsCost + row.dataTransferCost + snapshotCost + eipCost;
  const totalByBasis = toCostByBasis(row, selectedCostBasis);
  const otherCost = Math.max(0, totalByBasis - known);
  return {
    compute: row.computeCost,
    ebs: row.ebsCost,
    snapshot: snapshotCost,
    data_transfer: row.dataTransferCost,
    eip: eipCost,
    other: otherCost,
  };
};

const toCostByBasis = (row: Ec2ExplorerFactRow, basis: Ec2CostBasis): number => {
  if (basis === "billed_cost") return row.totalBilledCost;
  if (basis === "amortized_cost") return row.totalEffectiveCost;
  return row.totalEffectiveCost;
};

const matchesInstancesCondition = (row: Ec2ExplorerFactRow, condition: Ec2ExplorerInput["condition"]): boolean => {
  if (condition === "all") return true;
  if (condition === "idle") return row.isIdleCandidate;
  if (condition === "underutilized") return row.isUnderutilizedCandidate;
  if (condition === "overutilized") return row.isOverutilizedCandidate;
  if (condition === "uncovered") {
    return row.reservationType === "on_demand" || row.reservationType.length === 0;
  }
  return true;
};

const applyInstancesThresholdFilters = (
  rows: Ec2ExplorerFactRow[],
  input: Ec2ExplorerInput,
  additionalByDate: Map<string, Ec2ExplorerAdditionalDailyCosts>,
): Ec2ExplorerFactRow[] => {
  if (input.metric !== "instances") return rows;
  return rows.filter((row) => {
    if (!matchesInstancesCondition(row, input.condition)) return false;
    if (input.states.length > 0 && !input.states.map((item) => item.toLowerCase()).includes(row.state.toLowerCase())) {
      return false;
    }
    if (
      input.instanceTypes.length > 0 &&
      !input.instanceTypes.map((item) => item.toLowerCase()).includes(row.instanceType.toLowerCase())
    ) {
      return false;
    }

    const cost = toCostByBasis(row, input.costBasis);
    const cpu = row.cpuAvg;
    const networkGb = (row.networkInBytes + row.networkOutBytes) / NETWORK_DIVISOR_GB;

    if (typeof input.minCost === "number" && cost < input.minCost) return false;
    if (typeof input.maxCost === "number" && cost > input.maxCost) return false;
    if (typeof input.minCpu === "number" && cpu < input.minCpu) return false;
    if (typeof input.maxCpu === "number" && cpu > input.maxCpu) return false;
    if (typeof input.minNetwork === "number" && networkGb < input.minNetwork) return false;
    if (typeof input.maxNetwork === "number" && networkGb > input.maxNetwork) return false;
    return true;
  });
};

const applyGroupValueFilters = (rows: Ec2ExplorerFactRow[], input: Ec2ExplorerInput): Ec2ExplorerFactRow[] => {
  if (input.groupBy === "none") return rows;
  if (!Array.isArray(input.groupValues) || input.groupValues.length === 0) return rows;
  const selectedValues = new Set(input.groupValues.map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (selectedValues.size === 0) return rows;
  return rows.filter((row) => selectedValues.has(groupValueForRow(row, input).trim().toLowerCase()));
};

const groupValueForRow = (row: Ec2ExplorerFactRow, input: Ec2ExplorerInput): string => {
  if (input.groupBy === "region") return row.region || "Unknown";
  if (input.groupBy === "instance_type") return row.instanceType || "Unknown";
  if (input.groupBy === "reservation_type") {
    const reservation = (row.reservationType || "on_demand").toLowerCase();
    if (reservation === "savings_plan") return "savings_plan";
    if (reservation === "reserved") return "reserved";
    return "on_demand";
  }
  if (input.groupBy === "cost_category") return "cost_category";
  if (input.groupBy === "tag") return tagValueForKey(row.tagsJson, input.tagKey);
  return row.instanceName || row.instanceId;
};

const metricLabel = (key: string): string => {
  if (key === "total") return "Total";
  if (key === "compute") return "Compute";
  if (key === "ebs") return "EBS";
  if (key === "snapshot") return "Snapshot";
  if (key === "data_transfer") return "Data Transfer";
  if (key === "eip") return "EIP";
  if (key === "other") return "Other";
  if (key === "on_demand") return "on_demand";
  if (key === "reserved") return "reserved";
  if (key === "savings_plan") return "savings_plan";
  return key;
};

const buildSummary = (
  rows: Ec2ExplorerFactRow[],
  previousRows: Ec2ExplorerFactRow[],
  selectedCostBasis: Ec2CostBasis,
): Ec2ExplorerSummary => {
  const currentTotal = rows.reduce((sum, row) => {
    return sum + toCostByBasis(row, selectedCostBasis);
  }, 0);
  const previousTotal = previousRows.reduce((sum, row) => {
    return sum + toCostByBasis(row, selectedCostBasis);
  }, 0);
  const trendPercent = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
  const uniqueInstances = new Set(rows.map((row) => row.instanceId));
  const avgCpu = rows.length > 0 ? rows.reduce((sum, row) => sum + row.cpuAvg, 0) / rows.length : 0;
  const networkGb = rows.reduce(
    (sum, row) => sum + (row.networkInBytes + row.networkOutBytes) / NETWORK_DIVISOR_GB,
    0,
  );
  return {
    totalCost: toFixedNumber(currentTotal),
    previousCost: toFixedNumber(previousTotal),
    trendPercent: toFixedNumber(trendPercent),
    instanceCount: uniqueInstances.size,
    avgCpu: toFixedNumber(avgCpu, 1),
    totalNetworkGb: toFixedNumber(networkGb),
  };
};

const buildCostGraph = (
  rows: Ec2ExplorerFactRow[],
  input: Ec2ExplorerInput,
  additionalByDate: Map<string, Ec2ExplorerAdditionalDailyCosts>,
): Ec2ExplorerGraph => {
  const dateGroupMap = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const parts = toCostParts(row, additionalByDate, input.costBasis);
    const group = input.groupBy === "none" ? "total" : groupValueForRow(row, input);
    const byGroup = dateGroupMap.get(row.date) ?? new Map<string, number>();
    if (input.groupBy === "cost_category") {
      for (const component of COST_COMPONENTS) {
        byGroup.set(component, (byGroup.get(component) ?? 0) + (parts[component] ?? 0));
      }
    } else {
      byGroup.set(group, (byGroup.get(group) ?? 0) + toCostByBasis(row, input.costBasis));
    }
    dateGroupMap.set(row.date, byGroup);
  }

  const sortedDates = [...dateGroupMap.keys()].sort();
  const allGroups = new Set<string>();
  for (const byGroup of dateGroupMap.values()) {
    for (const key of byGroup.keys()) allGroups.add(key);
  }

  const orderedGroups = [...allGroups].sort((a, b) => {
    if (a === "total") return -1;
    if (b === "total") return 1;
    return a.localeCompare(b);
  });
  const series: Ec2ExplorerGraphSeries[] = orderedGroups.map((group) => ({
    key: group,
    label: group === "total" ? "Total" : metricLabel(group),
    data: sortedDates.map((date) => ({
      date,
      value: toFixedNumber(dateGroupMap.get(date)?.get(group) ?? 0),
    })),
  }));

  return {
    type: input.groupBy === "none" ? "bar" : "stacked_bar",
    xKey: "date",
    series,
  };
};

const buildUsageGraph = (rows: Ec2ExplorerFactRow[], input: Ec2ExplorerInput): Ec2ExplorerGraph => {
  const valueForRow = (row: Ec2ExplorerFactRow): number => {
    if (input.usageType === "network") {
      return (row.networkInBytes + row.networkOutBytes) / NETWORK_DIVISOR_GB;
    }
    if (input.usageType === "disk") {
      return input.aggregation === "max" ? row.diskUsedPercentMax : row.diskUsedPercentAvg;
    }
    return input.aggregation === "max" ? row.cpuMax : row.cpuAvg;
  };

  const aggregate = (values: number[]): number => {
    if (values.length === 0) return 0;
    if (input.aggregation === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
    if (input.aggregation === "max") return Math.max(...values);
    return percentile(values, 95);
  };

  const dateGroupMap = new Map<string, Map<string, number[]>>();
  for (const row of rows) {
    const dateMap = dateGroupMap.get(row.date) ?? new Map<string, number[]>();
    const group = input.groupBy === "none" ? "total" : groupValueForRow(row, input);
    const bucketValues = dateMap.get(group) ?? [];
    bucketValues.push(valueForRow(row));
    dateMap.set(group, bucketValues);
    dateGroupMap.set(row.date, dateMap);
  }

  const dates = [...dateGroupMap.keys()].sort();
  const allGroups = new Set<string>();
  for (const byGroup of dateGroupMap.values()) {
    for (const key of byGroup.keys()) allGroups.add(key);
  }

  const orderedGroups = [...allGroups].sort((a, b) => {
    if (a === "total") return -1;
    if (b === "total") return 1;
    return a.localeCompare(b);
  });

  const series: Ec2ExplorerGraphSeries[] = orderedGroups.map((group) => ({
    key: group,
    label: group === "total" ? "Total" : metricLabel(group),
    data: dates.map((date) => ({
      date,
      value: toFixedNumber(aggregate(dateGroupMap.get(date)?.get(group) ?? [])),
    })),
  }));

  return {
    type: input.groupBy === "none" ? "line" : "stacked_bar",
    xKey: "date",
    series,
  };
};

const buildInstancesGraph = (rows: Ec2ExplorerFactRow[], input: Ec2ExplorerInput): Ec2ExplorerGraph => {
  const dateGroupMap = new Map<string, Map<string, Set<string>>>();
  for (const row of rows) {
    const group = input.groupBy === "none" ? "total" : groupValueForRow(row, input);
    const byGroup = dateGroupMap.get(row.date) ?? new Map<string, Set<string>>();
    const ids = byGroup.get(group) ?? new Set<string>();
    ids.add(row.instanceId);
    byGroup.set(group, ids);
    dateGroupMap.set(row.date, byGroup);
  }

  const dates = [...dateGroupMap.keys()].sort();
  const allGroups = new Set<string>();
  for (const byGroup of dateGroupMap.values()) {
    for (const key of byGroup.keys()) allGroups.add(key);
  }

  const orderedGroups = [...allGroups].sort((a, b) => {
    if (a === "total") return -1;
    if (b === "total") return 1;
    return a.localeCompare(b);
  });

  return {
    type: "line",
    xKey: "date",
    series: orderedGroups.map((group) => ({
      key: group === "total" ? "instance_count" : group,
      label: group === "total" ? "Instance Count" : metricLabel(group),
      data: dates.map((date) => ({
        date,
        value: dateGroupMap.get(date)?.get(group)?.size ?? 0,
      })),
    })),
  };
};

const buildCostTable = (
  rows: Ec2ExplorerFactRow[],
  input: Ec2ExplorerInput,
  additionalByDate: Map<string, Ec2ExplorerAdditionalDailyCosts>,
): Ec2ExplorerTable => {
  if (input.groupBy === "none") {
    const columns: Ec2ExplorerTableColumn[] = [
      { key: "instance", label: "Instance" },
      { key: "totalCost", label: "Total Cost" },
      { key: "computeCost", label: "Compute Cost" },
      { key: "ebsCost", label: "EBS Cost" },
      { key: "snapshotCost", label: "Snapshot Cost" },
      { key: "dataTransferCost", label: "Data Transfer Cost" },
      { key: "instanceType", label: "Instance Type" },
      { key: "region", label: "Region" },
    ];
    const grouped = new Map<string, Ec2ExplorerTableRow>();
    for (const row of rows) {
      const id = row.instanceId;
      const cost = toCostParts(row, additionalByDate, input.costBasis);
      const current = grouped.get(id) ?? {
        id,
        instance: row.instanceName,
        totalCost: 0,
        computeCost: 0,
        ebsCost: 0,
        snapshotCost: 0,
        dataTransferCost: 0,
        instanceType: row.instanceType,
        region: row.region,
      };
      current.totalCost = Number(current.totalCost) + toCostByBasis(row, input.costBasis);
      current.computeCost = Number(current.computeCost) + cost.compute;
      current.ebsCost = Number(current.ebsCost) + cost.ebs;
      current.snapshotCost = Number(current.snapshotCost) + cost.snapshot;
      current.dataTransferCost = Number(current.dataTransferCost) + cost.data_transfer;
      grouped.set(id, current);
    }
    return {
      columns,
      rows: [...grouped.values()]
        .map((row) => ({
          ...row,
          totalCost: toFixedNumber(Number(row.totalCost)),
          computeCost: toFixedNumber(Number(row.computeCost)),
          ebsCost: toFixedNumber(Number(row.ebsCost)),
          snapshotCost: toFixedNumber(Number(row.snapshotCost)),
          dataTransferCost: toFixedNumber(Number(row.dataTransferCost)),
        }))
        .sort((a, b) => Number(b.totalCost) - Number(a.totalCost)),
    };
  }

  if (input.groupBy === "cost_category") {
    const columns: Ec2ExplorerTableColumn[] = [
      { key: "group", label: "Group" },
      { key: "totalCost", label: "Total Cost" },
      { key: "computeCost", label: "Compute Cost" },
      { key: "ebsCost", label: "EBS Cost" },
      { key: "snapshotCost", label: "Snapshot Cost" },
      { key: "dataTransferCost", label: "Data Transfer Cost" },
      { key: "instanceCount", label: "Instance Count" },
    ];
    const groups: Array<{ key: (typeof COST_COMPONENTS)[number]; label: string }> = [
      { key: "compute", label: "Compute" },
      { key: "ebs", label: "EBS" },
      { key: "snapshot", label: "Snapshot" },
      { key: "data_transfer", label: "Data Transfer" },
      { key: "eip", label: "EIP" },
      { key: "other", label: "Other" },
    ];
    const rowsOut = groups.map((group) => {
      let total = 0;
      let compute = 0;
      let ebs = 0;
      let snapshot = 0;
      let dataTransfer = 0;
      const instanceIds = new Set<string>();
      for (const row of rows) {
        const cost = toCostParts(row, additionalByDate, input.costBasis);
        const value = cost[group.key] ?? 0;
        total += value;
        if (group.key === "compute") compute += value;
        if (group.key === "ebs") ebs += value;
        if (group.key === "snapshot") snapshot += value;
        if (group.key === "data_transfer") dataTransfer += value;
        if (value > 0) instanceIds.add(row.instanceId);
      }
      return {
        id: `cost_category-${group.key}`,
        group: group.label,
        totalCost: toFixedNumber(total),
        computeCost: toFixedNumber(compute),
        ebsCost: toFixedNumber(ebs),
        snapshotCost: toFixedNumber(snapshot),
        dataTransferCost: toFixedNumber(dataTransfer),
        instanceCount: instanceIds.size,
      };
    });
    return { columns, rows: rowsOut };
  }

  const columns: Ec2ExplorerTableColumn[] = [
    { key: "group", label: "Group" },
    { key: "totalCost", label: "Total Cost" },
    { key: "computeCost", label: "Compute Cost" },
    { key: "ebsCost", label: "EBS Cost" },
    { key: "snapshotCost", label: "Snapshot Cost" },
    { key: "dataTransferCost", label: "Data Transfer Cost" },
    { key: "instanceCount", label: "Instance Count" },
  ];
  type CostGroupRow = {
    id: string;
    group: string;
    totalCost: number;
    computeCost: number;
    ebsCost: number;
    snapshotCost: number;
    dataTransferCost: number;
    instanceCount: number;
    instanceIds: Set<string>;
  };
  const grouped = new Map<string, CostGroupRow>();
  for (const row of rows) {
    const group = groupValueForRow(row, input);
    const id = `${input.groupBy}-${group}`;
    const cost = toCostParts(row, additionalByDate, input.costBasis);
    const current: CostGroupRow = grouped.get(id) ?? {
      id,
      group,
      totalCost: 0,
      computeCost: 0,
      ebsCost: 0,
      snapshotCost: 0,
      dataTransferCost: 0,
      instanceCount: 0,
      instanceIds: new Set<string>(),
    };
    current.totalCost = Number(current.totalCost) + toCostByBasis(row, input.costBasis);
    current.computeCost = Number(current.computeCost) + cost.compute;
    current.ebsCost = Number(current.ebsCost) + cost.ebs;
    current.snapshotCost = Number(current.snapshotCost) + cost.snapshot;
    current.dataTransferCost = Number(current.dataTransferCost) + cost.data_transfer;
    current.instanceIds.add(row.instanceId);
    current.instanceCount = current.instanceIds.size;
    grouped.set(id, current);
  }

  const rowsOut = [...grouped.values()]
    .map(({ instanceIds: _ignored, ...row }) => ({
      ...row,
      totalCost: toFixedNumber(Number(row.totalCost)),
      computeCost: toFixedNumber(Number(row.computeCost)),
      ebsCost: toFixedNumber(Number(row.ebsCost)),
      snapshotCost: toFixedNumber(Number(row.snapshotCost)),
      dataTransferCost: toFixedNumber(Number(row.dataTransferCost)),
      instanceCount: Number(row.instanceCount),
    }))
    .sort((a, b) => Number(b.totalCost) - Number(a.totalCost));

  return { columns, rows: rowsOut };
};

const buildUsageTable = (rows: Ec2ExplorerFactRow[], input: Ec2ExplorerInput): Ec2ExplorerTable => {
  if (input.groupBy === "none") {
    const columns: Ec2ExplorerTableColumn[] = [
      { key: "instance", label: "Instance" },
      { key: "avgCpu", label: "Avg CPU" },
      { key: "maxCpu", label: "Max CPU" },
      { key: "networkIn", label: "Network In" },
      { key: "networkOut", label: "Network Out" },
      { key: "instanceType", label: "Instance Type" },
      { key: "region", label: "Region" },
    ];
    const grouped = new Map<string, Ec2ExplorerTableRow & { sampleCount: number }>();
    for (const row of rows) {
      const id = row.instanceId;
      const current = grouped.get(id) ?? {
        id,
        instance: row.instanceName,
        avgCpu: 0,
        maxCpu: 0,
        networkIn: 0,
        networkOut: 0,
        instanceType: row.instanceType,
        region: row.region,
        sampleCount: 0,
      };
      current.avgCpu = Number(current.avgCpu) + row.cpuAvg;
      current.maxCpu = Math.max(Number(current.maxCpu), row.cpuMax);
      current.networkIn = Number(current.networkIn) + row.networkInBytes / NETWORK_DIVISOR_GB;
      current.networkOut = Number(current.networkOut) + row.networkOutBytes / NETWORK_DIVISOR_GB;
      current.sampleCount += 1;
      grouped.set(id, current);
    }
    const rowsOut = [...grouped.values()].map(({ sampleCount, ...row }) => ({
      ...row,
      avgCpu: toFixedNumber(Number(row.avgCpu) / Math.max(1, sampleCount), 2),
      maxCpu: toFixedNumber(Number(row.maxCpu), 2),
      networkIn: toFixedNumber(Number(row.networkIn), 2),
      networkOut: toFixedNumber(Number(row.networkOut), 2),
    }));
    return { columns, rows: rowsOut.sort((a, b) => Number(b.networkIn) - Number(a.networkIn)) };
  }

  const columns: Ec2ExplorerTableColumn[] = [
    { key: "group", label: "Group" },
    { key: "avgCpu", label: "Avg CPU" },
    { key: "maxCpu", label: "Max CPU" },
    { key: "networkIn", label: "Network In" },
    { key: "networkOut", label: "Network Out" },
    { key: "instanceCount", label: "Instance Count" },
  ];
  type UsageGroupRow = {
    id: string;
    group: string;
    avgCpu: number;
    maxCpu: number;
    networkIn: number;
    networkOut: number;
    instanceCount: number;
    sampleCount: number;
    instanceIds: Set<string>;
  };
  const grouped = new Map<string, UsageGroupRow>();
  for (const row of rows) {
    const group = groupValueForRow(row, input);
    const id = `${input.groupBy}-${group}`;
    const current: UsageGroupRow = grouped.get(id) ?? {
      id,
      group,
      avgCpu: 0,
      maxCpu: 0,
      networkIn: 0,
      networkOut: 0,
      instanceCount: 0,
      sampleCount: 0,
      instanceIds: new Set<string>(),
    };
    current.avgCpu = Number(current.avgCpu) + row.cpuAvg;
    current.maxCpu = Math.max(Number(current.maxCpu), row.cpuMax);
    current.networkIn = Number(current.networkIn) + row.networkInBytes / NETWORK_DIVISOR_GB;
    current.networkOut = Number(current.networkOut) + row.networkOutBytes / NETWORK_DIVISOR_GB;
    current.sampleCount += 1;
    current.instanceIds.add(row.instanceId);
    current.instanceCount = current.instanceIds.size;
    grouped.set(id, current);
  }
  const rowsOut = [...grouped.values()].map(({ sampleCount, instanceIds: _ignored, ...row }) => ({
    ...row,
    avgCpu: toFixedNumber(Number(row.avgCpu) / Math.max(1, sampleCount), 2),
    maxCpu: toFixedNumber(Number(row.maxCpu), 2),
    networkIn: toFixedNumber(Number(row.networkIn), 2),
    networkOut: toFixedNumber(Number(row.networkOut), 2),
    instanceCount: Number(row.instanceCount),
  }));
  return { columns, rows: rowsOut.sort((a, b) => Number(b.networkIn) - Number(a.networkIn)) };
};

const buildInstancesTable = (
  rows: Ec2ExplorerFactRow[],
  input: Ec2ExplorerInput,
  additionalByDate: Map<string, Ec2ExplorerAdditionalDailyCosts>,
): Ec2ExplorerTable => {
  if (input.groupBy === "none") {
    const columns: Ec2ExplorerTableColumn[] = [
      { key: "instance", label: "Instance" },
      { key: "cost", label: "Cost" },
      { key: "cpu", label: "CPU" },
      { key: "network", label: "Network" },
      { key: "state", label: "State" },
      { key: "instanceType", label: "Instance Type" },
      { key: "region", label: "Region" },
    ];
    const grouped = new Map<string, Ec2ExplorerTableRow & { sampleCount: number }>();
    for (const row of rows) {
      const id = row.instanceId;
      const cost = toCostByBasis(row, input.costBasis);
      const current = grouped.get(id) ?? {
        id,
        instance: row.instanceName,
        cost: 0,
        cpu: 0,
        network: 0,
        state: row.state,
        instanceType: row.instanceType,
        region: row.region,
        sampleCount: 0,
      };
      current.cost = Number(current.cost) + cost;
      current.cpu = Number(current.cpu) + row.cpuAvg;
      current.network = Number(current.network) + (row.networkInBytes + row.networkOutBytes) / NETWORK_DIVISOR_GB;
      current.sampleCount += 1;
      grouped.set(id, current);
    }
    const rowsOut = [...grouped.values()].map(({ sampleCount, ...row }) => ({
      ...row,
      cost: toFixedNumber(Number(row.cost)),
      cpu: toFixedNumber(Number(row.cpu) / Math.max(1, sampleCount), 2),
      network: toFixedNumber(Number(row.network), 2),
    }));
    return { columns, rows: rowsOut.sort((a, b) => Number(b.cost) - Number(a.cost)) };
  }

  const columns: Ec2ExplorerTableColumn[] = [
    { key: "group", label: "Group" },
    { key: "instanceCount", label: "Instance Count" },
    { key: "avgCost", label: "Avg Cost" },
    { key: "avgCpu", label: "Avg CPU" },
    { key: "totalCost", label: "Total Cost" },
  ];
  type InstancesGroupRow = {
    id: string;
    group: string;
    instanceCount: number;
    avgCost: number;
    avgCpu: number;
    totalCost: number;
    sampleCount: number;
    instanceIds: Set<string>;
  };
  const grouped = new Map<string, InstancesGroupRow>();
  for (const row of rows) {
    const group = groupValueForRow(row, input);
    const id = `${input.groupBy}-${group}`;
    const cost = toCostByBasis(row, input.costBasis);
    const current: InstancesGroupRow = grouped.get(id) ?? {
      id,
      group,
      instanceCount: 0,
      avgCost: 0,
      avgCpu: 0,
      totalCost: 0,
      sampleCount: 0,
      instanceIds: new Set<string>(),
    };
    current.totalCost = Number(current.totalCost) + cost;
    current.avgCpu = Number(current.avgCpu) + row.cpuAvg;
    current.sampleCount += 1;
    current.instanceIds.add(row.instanceId);
    current.instanceCount = current.instanceIds.size;
    grouped.set(id, current);
  }
  const rowsOut = [...grouped.values()].map(({ sampleCount, instanceIds: _ignored, ...row }) => {
    const avgCost = Number(row.totalCost) / Math.max(1, Number(row.instanceCount));
    return {
      ...row,
      instanceCount: Number(row.instanceCount),
      avgCost: toFixedNumber(avgCost),
      avgCpu: toFixedNumber(Number(row.avgCpu) / Math.max(1, sampleCount), 2),
      totalCost: toFixedNumber(Number(row.totalCost)),
    };
  });
  return { columns, rows: rowsOut.sort((a, b) => Number(b.totalCost) - Number(a.totalCost)) };
};

export class Ec2ExplorerService {
  private readonly query: Ec2ExplorerQuery;

  constructor(query: Ec2ExplorerQuery = new Ec2ExplorerQuery()) {
    this.query = query;
  }

  async getExplorer(input: Ec2ExplorerInput): Promise<Ec2ExplorerResponse> {
    const durationDays = dateRangeDaysInclusive(input.startDate, input.endDate);
    const previousStartDate = shiftDate(input.startDate, -durationDays);
    const previousEndDate = shiftDate(input.endDate, -durationDays);

    const [rows, previousRows, additionalDailyCosts] = await Promise.all([
      this.query.getFactRows(input),
      this.query.getFactRows({
        ...input,
        startDate: previousStartDate,
        endDate: previousEndDate,
      }),
      this.query.getAdditionalDailyCosts(input),
    ]);

    const additionalByDate = new Map(additionalDailyCosts.map((item) => [item.date, item]));
    const groupedRows = applyGroupValueFilters(rows, input);
    const groupedPreviousRows = applyGroupValueFilters(previousRows, input);
    const filteredRows = applyInstancesThresholdFilters(groupedRows, input, additionalByDate);
    const filteredPreviousRows = applyInstancesThresholdFilters(groupedPreviousRows, input, additionalByDate);

    const selectedCostBasis = input.metric === "cost" ? input.costBasis : "effective_cost";
    const summary = buildSummary(filteredRows, filteredPreviousRows, selectedCostBasis);

    let graph: Ec2ExplorerGraph;
    if (input.metric === "cost") {
      graph = buildCostGraph(filteredRows, input, additionalByDate);
    } else if (input.metric === "usage") {
      graph = buildUsageGraph(filteredRows, input);
    } else {
      graph = buildInstancesGraph(filteredRows, input);
    }

    let table: Ec2ExplorerTable;
    if (input.metric === "cost") {
      table = buildCostTable(filteredRows, input, additionalByDate);
    } else if (input.metric === "usage") {
      table = buildUsageTable(filteredRows, input);
    } else {
      table = buildInstancesTable(filteredRows, input, additionalByDate);
    }

    return {
      summary,
      graph,
      table,
    };
  }
}
