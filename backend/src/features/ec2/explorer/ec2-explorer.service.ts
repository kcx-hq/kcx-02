import type {
  Ec2ExplorerAdditionalDailyCosts,
  Ec2CostBasis,
  Ec2ExplorerFactRow,
  Ec2ExplorerGraph,
  Ec2ExplorerGraphSeries,
  Ec2ExplorerInput,
  Ec2ExplorerVolumeRow,
  Ec2NetworkBreakdownResponse,
  Ec2ExplorerResponse,
  Ec2ExplorerSummary,
  Ec2ExplorerTable,
  Ec2ExplorerTableColumn,
  Ec2ExplorerTableRow,
} from "./ec2-explorer.types.js";
import { Ec2ExplorerQuery } from "./ec2-explorer.query.js";
import { logger } from "../../../utils/logger.js";
import { classifyDataTransferSignals, TRANSFER_TYPE_LABELS } from "../classification/data-transfer-classifier.js";

const NETWORK_DIVISOR_GB = 1024 * 1024 * 1024;
const COST_COMPONENTS = [
  "compute",
  "ebs",
  "snapshot",
  "data_transfer",
  "nat_gateway",
  "eip",
  "load_balancer",
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

const bucketDate = (dateIso: string, granularity: Ec2ExplorerInput["granularity"]): string => {
  if (granularity === "monthly") return dateIso.slice(0, 7);
  if (granularity === "hourly") return `${dateIso}T00:00:00Z`;
  return dateIso;
};

const toEbsVolumeCost = (row: Ec2ExplorerVolumeRow): number => {
  const detailed = row.storageCost + row.ioCost + row.throughputCost;
  return detailed > 0 ? detailed : row.totalCost;
};

const toStorageTier = (volumeType: string): string => {
  const vt = volumeType.trim().toLowerCase();
  if (["gp2", "gp3", "io1", "io2"].includes(vt)) return "SSD";
  if (["st1", "sc1"].includes(vt)) return "HDD";
  return "Unknown";
};

const toIopsTier = (volumeType: string, ioCost: number): string => {
  const vt = volumeType.trim().toLowerCase();
  if (["io1", "io2"].includes(vt) || ioCost > 0) return "provisioned";
  if (["gp2", "gp3", "st1", "sc1"].includes(vt)) return "standard";
  return "unknown";
};

const toSizeBucket = (sizeGb: number): string => {
  if (sizeGb <= 100) return "0-100 GB";
  if (sizeGb <= 500) return "101-500 GB";
  if (sizeGb <= 1024) return "501 GB-1 TB";
  return "1 TB+";
};

const toLifecycleState = (state: string): string => {
  const s = state.trim().toLowerCase();
  if (s === "in-use") return "in-use";
  if (s === "available") return "available";
  if (s === "deleted") return "deleted";
  return "unknown";
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
  const additional = additionalByDate.get(`${row.date}::${row.instanceId}`);
  const snapshotCost = additional?.snapshotCost ?? 0;
  const natGatewayCost = additional?.natGatewayCost ?? 0;
  const eipCost = additional?.eipCost ?? 0;
  const loadBalancerCost = additional?.loadBalancerCost ?? 0;
  const dataTransferCost = Math.max(0, row.dataTransferCost - natGatewayCost - eipCost - loadBalancerCost);
  const known = row.computeCost + row.ebsCost + dataTransferCost + snapshotCost + natGatewayCost + eipCost + loadBalancerCost;
  const totalByBasis = toCostByBasis(row, selectedCostBasis);
  const otherCost = Math.max(0, totalByBasis - known);
  return {
    compute: row.computeCost,
    ebs: row.ebsCost,
    snapshot: snapshotCost,
    data_transfer: dataTransferCost,
    nat_gateway: natGatewayCost,
    eip: eipCost,
    load_balancer: loadBalancerCost,
    other: otherCost,
  };
};

const toCostByBasis = (row: Ec2ExplorerFactRow, basis: Ec2CostBasis): number => {
  if (basis === "billed_cost") return row.totalBilledCost;
  if (basis === "amortized_cost") return row.totalAmortizedCost ?? row.totalEffectiveCost;
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
  if (input.groupBy === "availability_zone") return row.region || "Unknown";
  if (input.groupBy === "account") return row.account || "Unknown";
  if (input.groupBy === "instance_type") return row.instanceType || "Unknown";
  if (input.groupBy === "usage_type") return input.usageType;
  if (input.groupBy === "operation") return "unknown";
  if (input.groupBy === "instance_state") return row.state || "unknown";
  if (input.groupBy === "recommendation") {
    if (row.isIdleCandidate) return "idle";
    if (row.isUnderutilizedCandidate) return "underutilized";
    if (row.isOverutilizedCandidate) return "overutilized";
    if (row.reservationType === "on_demand" || row.reservationType.length === 0) return "uncovered";
    return "healthy";
  }
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
  if (key === "nat_gateway") return "NAT Gateway";
  if (key === "eip") return "EIP";
  if (key === "load_balancer") return "Load Balancer";
  if (key === "other") return "Other";
  if (key === "internet_data_transfer") return "Internet Data Transfer";
  if (key === "inter_region_data_transfer") return "Inter-Region Data Transfer";
  if (key === "inter_az_data_transfer") return "Inter-AZ Data Transfer";
  if (key === "elastic_ip") return "Elastic IP";
  if (key === "other_network") return "Other Network";
  if (key === "on_demand") return "on_demand";
  if (key === "reserved") return "reserved";
  if (key === "savings_plan") return "savings_plan";
  if (key === "team") return "Team";
  if (key === "product") return "Product";
  if (key === "environment") return "Environment";
  if (key === "account") return "Account";
  if (key === "internet") return TRANSFER_TYPE_LABELS.internet;
  if (key === "inter_region") return TRANSFER_TYPE_LABELS.inter_region;
  if (key === "inter_az") return TRANSFER_TYPE_LABELS.inter_az;
  if (key === "regional") return TRANSFER_TYPE_LABELS.regional;
  if (key === "unknown") return TRANSFER_TYPE_LABELS.unknown;
  return key;
};

type CurCostRow = {
  date: string;
  category: "compute" | "ebs" | "snapshot" | "data_transfer" | "nat_gateway" | "elastic_ip" | "load_balancer" | "other";
  cost: number;
  usageType: string | null;
  productUsageType: string | null;
  operation: string | null;
  productFamily: string | null;
  lineItemDescription: string | null;
  lineItemType: string | null;
  serviceName: string | null;
  lineItemResourceId: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  fromRegionCode: string | null;
  toRegionCode: string | null;
  region: string;
  account: string;
  instanceType: string;
  reservationType: string;
  team: string;
  product: string;
  environment: string;
  instanceId: string | null;
  attachedInstanceId: string | null;
  usageQuantity: number;
  tagsJson: Record<string, unknown> | null;
};

const toPossibleInstanceId = (value: string | null | undefined): string | null => {
  const match = String(value ?? "").toLowerCase().match(/\bi-[a-z0-9-]+\b/);
  return match?.[0] ?? null;
};

const groupForCurCostRow = (row: CurCostRow, input: Ec2ExplorerInput): string => {
  if (input.groupBy === "none") return "total";
  if (input.groupBy === "cost_category") return row.category;
  if (input.groupBy === "region") return row.region || "Unknown";
  if (input.groupBy === "availability_zone") return row.region || "Unknown";
  if (input.groupBy === "account") return row.account || "Unknown";
  if (input.groupBy === "instance_type") return row.instanceType || "Unknown";
  if (input.groupBy === "source_region") return row.fromRegionCode || "Unknown";
  if (input.groupBy === "destination_region") return row.toRegionCode || "Unknown";
  if (input.groupBy === "transfer_type") return classifyDataTransferSignals(row).transferType;
  if (input.groupBy === "usage_type") return (row.usageType ?? "unknown").trim() || "unknown";
  if (input.groupBy === "operation") return (row.operation ?? "unknown").trim() || "unknown";
  if (input.groupBy === "reservation_type") return row.reservationType || "on_demand";
  if (input.groupBy === "tag") return tagValueForKey(row.tagsJson, input.tagKey);
  if (input.groupBy === "instance") {
    if (row.category === "compute") return row.instanceId || "Unknown";
    if (row.category === "ebs") return row.attachedInstanceId || "Unattached";
    return row.instanceId || row.attachedInstanceId || "Unknown";
  }
  return "total";
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
    volumeCount: 0,
    attachedInstanceCount: uniqueInstances.size,
    unattachedVolumeCount: 0,
    storageGb: 0,
    storageGbHours: 0,
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

const toNetworkKey = (label: string): string =>
  label.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const buildNetworkCostGraph = (
  dailyRows: Array<{ date: string; category: string; cost: number; billedUsage: number }>,
  input: Ec2ExplorerInput,
  metric: "cost" | "usage" = "cost",
): Ec2ExplorerGraph => {
  const dateMap = new Map<string, Map<string, number>>();
  for (const row of dailyRows) {
    const key = toNetworkKey(row.category);
    if (Array.isArray(input.groupValues) && input.groupValues.length > 0) {
      const selected = new Set(input.groupValues.map((v) => v.trim().toLowerCase()));
      if (!selected.has(key) && !selected.has(row.category.trim().toLowerCase())) continue;
    }
    const byGroup = dateMap.get(row.date) ?? new Map<string, number>();
    byGroup.set(key, (byGroup.get(key) ?? 0) + (metric === "usage" ? row.billedUsage : row.cost));
    dateMap.set(row.date, byGroup);
  }
  const dates = [...dateMap.keys()].sort();
  const groups = new Set<string>();
  for (const byGroup of dateMap.values()) for (const key of byGroup.keys()) groups.add(key);
  const ordered = [...groups].sort((a, b) => a.localeCompare(b));
  return {
    type: "stacked_bar",
    xKey: "date",
    series: ordered.map((group) => ({
      key: group,
      label: metricLabel(group),
      data: dates.map((date) => ({
        date,
        value: toFixedNumber(dateMap.get(date)?.get(group) ?? 0),
      })),
    })),
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
  volumeRows: Ec2ExplorerVolumeRow[] = [],
): Ec2ExplorerTable => {
  if (input.groupBy === "none") {
    const columns: Ec2ExplorerTableColumn[] = [
      { key: "instance", label: "Instance" },
      { key: "totalCost", label: "Total Cost" },
      { key: "computeCost", label: "Compute Cost" },
      { key: "ebsCost", label: "EBS Cost" },
      { key: "snapshotCost", label: "Snapshot Cost" },
      { key: "dataTransferCost", label: "Data Transfer Cost" },
      { key: "natGatewayCost", label: "NAT Gateway Cost" },
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
        natGatewayCost: 0,
        instanceType: row.instanceType,
        region: row.region,
      };
      current.totalCost = Number(current.totalCost) + toCostByBasis(row, input.costBasis);
      current.computeCost = Number(current.computeCost) + cost.compute;
      current.ebsCost = Number(current.ebsCost) + cost.ebs;
      current.snapshotCost = Number(current.snapshotCost) + cost.snapshot;
      current.dataTransferCost = Number(current.dataTransferCost) + cost.data_transfer;
      current.natGatewayCost = Number(current.natGatewayCost) + cost.nat_gateway;
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
          natGatewayCost: toFixedNumber(Number(row.natGatewayCost)),
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
      { key: "natGatewayCost", label: "NAT Gateway Cost" },
      { key: "instanceCount", label: "Instance Count" },
    ];
    const groups: Array<{ key: (typeof COST_COMPONENTS)[number]; label: string }> = [
      { key: "compute", label: "Compute" },
      { key: "ebs", label: "EBS" },
      { key: "snapshot", label: "Snapshot" },
      { key: "data_transfer", label: "Data Transfer" },
      { key: "nat_gateway", label: "NAT Gateway" },
      { key: "eip", label: "EIP" },
      { key: "load_balancer", label: "Load Balancer" },
      { key: "other", label: "Other" },
    ];
    const rowsOut = groups.map((group) => {
      let total = 0;
      let compute = 0;
      let ebs = 0;
      let snapshot = 0;
      let dataTransfer = 0;
      let natGateway = 0;
      const instanceIds = new Set<string>();
      for (const row of rows) {
        const cost = toCostParts(row, additionalByDate, input.costBasis);
        const value = cost[group.key] ?? 0;
        total += value;
        if (group.key === "compute") compute += value;
        if (group.key === "ebs") ebs += value;
        if (group.key === "snapshot") snapshot += value;
        if (group.key === "data_transfer") dataTransfer += value;
        if (group.key === "nat_gateway") natGateway += value;
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
        natGatewayCost: toFixedNumber(natGateway),
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
    { key: "natGatewayCost", label: "NAT Gateway Cost" },
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
    natGatewayCost: number;
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
      natGatewayCost: 0,
      instanceCount: 0,
      instanceIds: new Set<string>(),
    };
    current.totalCost = Number(current.totalCost) + toCostByBasis(row, input.costBasis);
    current.computeCost = Number(current.computeCost) + cost.compute;
    current.ebsCost = Number(current.ebsCost) + cost.ebs;
    current.snapshotCost = Number(current.snapshotCost) + cost.snapshot;
    current.dataTransferCost = Number(current.dataTransferCost) + cost.data_transfer;
    current.natGatewayCost = Number(current.natGatewayCost) + cost.nat_gateway;
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
      natGatewayCost: toFixedNumber(Number(row.natGatewayCost)),
      instanceCount: Number(row.instanceCount),
    }))
    .sort((a, b) => Number(b.totalCost) - Number(a.totalCost));

  if (input.groupBy === "instance") {
    const ebsByGroup = new Map<string, number>();
    for (const vr of volumeRows) {
      const key = vr.attachedInstanceName ?? vr.attachedInstanceId ?? "Unattached";
      ebsByGroup.set(key, (ebsByGroup.get(key) ?? 0) + toEbsVolumeCost(vr));
    }
    for (const row of rowsOut) {
      row.ebsCost = toFixedNumber(ebsByGroup.get(String(row.group)) ?? 0);
    }
    if (ebsByGroup.has("Unattached") && !rowsOut.some((row) => String(row.group) === "Unattached")) {
      rowsOut.push({
        id: `${input.groupBy}-Unattached`,
        group: "Unattached",
        totalCost: toFixedNumber(ebsByGroup.get("Unattached") ?? 0),
        computeCost: 0,
        ebsCost: toFixedNumber(ebsByGroup.get("Unattached") ?? 0),
        snapshotCost: 0,
        dataTransferCost: 0,
        natGatewayCost: 0,
        instanceCount: 0,
      });
    }
  }

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

const buildNetworkCostTable = (
  categories: Array<{ type: string; cost: number; percent: number; usageQuantity: number; resourceCount: number }>,
  input: Ec2ExplorerInput,
  metric: "cost" | "usage" = "cost",
): Ec2ExplorerTable => {
  const selected = new Set(input.groupValues.map((value) => value.trim().toLowerCase()));
  const rows = categories
    .filter((item) => selected.size === 0 || selected.has(toNetworkKey(item.type)) || selected.has(item.type.trim().toLowerCase()))
    .map((item) => ({
      id: `network-${toNetworkKey(item.type)}`,
      group: item.type,
      totalCost: toFixedNumber(item.cost),
      percentOfNetwork: toFixedNumber(item.percent),
      usageQuantity: toFixedNumber(item.usageQuantity),
      resourceCount: item.resourceCount,
    }))
    .sort((a, b) => (metric === "usage" ? Number(b.usageQuantity) - Number(a.usageQuantity) : Number(b.totalCost) - Number(a.totalCost)));
  return {
    columns: [
      { key: "group", label: metric === "usage" ? "Network Type" : "Group" },
      { key: "usageQuantity", label: "Billed Usage (GB)" },
      { key: "percentOfNetwork", label: metric === "usage" ? "% of Network Usage" : "% of Network" },
      { key: "totalCost", label: metric === "usage" ? "Network Cost ($)" : "Cost ($)" },
      { key: "resourceCount", label: "Resource Count" },
    ],
    rows,
  };
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
    if (input.metric === "volumes") {
      const [costRows, metadataRows] = await Promise.all([
        this.query.getVolumeRows(input),
        this.query.getVolumeMetadataRows(input),
      ]);
      const durationDays = dateRangeDaysInclusive(input.startDate, input.endDate);
      const previousStartDate = shiftDate(input.startDate, -durationDays);
      const previousEndDate = shiftDate(input.endDate, -durationDays);
      const [previousCostRows, previousMetadataRows] = await Promise.all([
        this.query.getVolumeRows({
          ...input,
          startDate: previousStartDate,
          endDate: previousEndDate,
        }),
        this.query.getVolumeMetadataRows({
          ...input,
          startDate: previousStartDate,
          endDate: previousEndDate,
        }),
      ]);
      const mergeRows = (costOnlyRows: Ec2ExplorerVolumeRow[], metaOnlyRows: Ec2ExplorerVolumeRow[]): Ec2ExplorerVolumeRow[] => {
        const merged = new Map<string, Ec2ExplorerVolumeRow>();
        for (const metaRow of metaOnlyRows) {
          merged.set(`${metaRow.date}::${metaRow.volumeId}`, { ...metaRow });
        }
        for (const costRow of costOnlyRows) {
          const key = `${costRow.date}::${costRow.volumeId}`;
          const current = merged.get(key);
          merged.set(key, current ? {
            ...current,
            storageCost: costRow.storageCost,
            ioCost: costRow.ioCost,
            throughputCost: costRow.throughputCost,
            totalCost: costRow.totalCost,
          } : costRow);
        }
        return [...merged.values()];
      };
      const rows = mergeRows(costRows, metadataRows);
      const previousRows = mergeRows(previousCostRows, previousMetadataRows);
      const groupFor = (row: Ec2ExplorerVolumeRow): string => {
        if (input.groupBy === "volume") return row.volumeName || row.volumeId || "Unknown";
        if (input.groupBy === "account") return row.account;
        if (input.groupBy === "region") return row.region;
        if (input.groupBy === "availability_zone") return row.region;
        if (input.groupBy === "volume_type") return row.volumeType;
        if (input.groupBy === "attachment_state") return row.attachedInstanceId ? "Attached" : "Unattached";
        if (input.groupBy === "instance") return row.attachedInstanceName ?? row.attachedInstanceId ?? "Unattached";
        if (input.groupBy === "storage_tier") return toStorageTier(row.volumeType);
        if (input.groupBy === "iops_tier") return toIopsTier(row.volumeType, row.ioCost);
        if (input.groupBy === "size_bucket") return toSizeBucket(row.sizeGb);
        if (input.groupBy === "lifecycle_state") return toLifecycleState(row.state);
        if (input.groupBy === "tag") return tagValueForKey(row.tagsJson, input.tagKey);
        return "total";
      };

      const filtered = rows.filter((row) => {
        if (input.teams.length > 0 && !input.teams.map((v) => v.toLowerCase()).includes(row.team.toLowerCase())) return false;
        if (input.products.length > 0 && !input.products.map((v) => v.toLowerCase()).includes(row.product.toLowerCase())) return false;
        if (input.environments.length > 0 && !input.environments.map((v) => v.toLowerCase()).includes(row.environment.toLowerCase())) return false;
        if (input.accounts.length > 0 && !input.accounts.map((v) => v.toLowerCase()).includes(row.account.toLowerCase())) return false;
        if (input.volumeTypes.length > 0 && !input.volumeTypes.map((v) => v.toLowerCase()).includes(row.volumeType.toLowerCase())) return false;
        if (input.volumeAttachment === "attached" && !row.attachedInstanceId) return false;
        if (input.volumeAttachment === "unattached" && row.attachedInstanceId) return false;
        if (input.volumeStatuses.length > 0 && !input.volumeStatuses.map((v) => v.toLowerCase()).includes(row.state.toLowerCase())) return false;
        if (input.groupValues.length > 0) {
          const g = (input.groupBy === "none" ? "total" : groupFor(row)).toLowerCase();
          if (!input.groupValues.map((v) => v.toLowerCase()).includes(g)) return false;
        }
        return true;
      });

      const points = new Map<string, Map<string, { volumes: Set<string>; instances: Set<string>; storageGb: number; storageGbHours: number; totalCost: number }>>();
      for (const row of filtered) {
        const date = bucketDate(row.date, input.granularity);
        const group = input.groupBy === "none" ? "total" : groupFor(row);
        const byGroup = points.get(date) ?? new Map<string, { volumes: Set<string>; instances: Set<string>; storageGb: number; storageGbHours: number; totalCost: number }>();
        const current = byGroup.get(group) ?? { volumes: new Set<string>(), instances: new Set<string>(), storageGb: 0, storageGbHours: 0, totalCost: 0 };
        const isNewVolume = !current.volumes.has(row.volumeId);
        current.volumes.add(row.volumeId);
        if (row.attachedInstanceId) current.instances.add(row.attachedInstanceId);
        if (isNewVolume) {
          current.storageGb += row.sizeGb;
          current.storageGbHours += row.sizeGb * 24;
          current.totalCost += toEbsVolumeCost(row);
        }
        byGroup.set(group, current);
        points.set(date, byGroup);
      }

      const dates = [...points.keys()].sort();
      const groups = new Set<string>();
      points.forEach((g) => g.forEach((_v, k) => groups.add(k)));
      const series = [...groups].sort().map((key) => ({
        key,
        label: key === "total" ? "Total" : key,
        data: dates.map((date) => {
          const cell = points.get(date)?.get(key);
          const value = input.volumeView === "count"
            ? cell?.volumes.size ?? 0
            : input.volumeView === "storage"
              ? cell?.storageGb ?? 0
              : input.volumeView === "storage_hours"
                ? cell?.storageGbHours ?? 0
                : cell?.totalCost ?? 0;
          return { date, value: toFixedNumber(value) };
        }),
      }));

      const overallVolumes = new Set(filtered.map((row) => row.volumeId));
      const overallInstances = new Set(
        filtered.map((row) => row.attachedInstanceId).filter((v): v is string => Boolean(v)),
      );
      const unattachedVolumes = new Set(
        filtered.filter((row) => !row.attachedInstanceId).map((row) => row.volumeId),
      );
      const totalCost = filtered.reduce((sum, row) => sum + toEbsVolumeCost(row), 0);
      const previousCost = previousRows.reduce((sum, row) => sum + toEbsVolumeCost(row), 0);
      const trendPercent = previousCost > 0 ? ((totalCost - previousCost) / previousCost) * 100 : 0;
      const storageByVolume = new Map<string, { date: string; sizeGb: number }>();
      for (const row of filtered) {
        const current = storageByVolume.get(row.volumeId);
        if (!current || row.date > current.date) storageByVolume.set(row.volumeId, { date: row.date, sizeGb: row.sizeGb });
      }
      const storageGb = [...storageByVolume.values()].reduce((sum, value) => sum + value.sizeGb, 0);
      const storageGbHours = filtered.reduce((sum, row) => sum + row.sizeGb * 24, 0);
      const summary = {
        totalCost: toFixedNumber(totalCost),
        previousCost: toFixedNumber(previousCost),
        trendPercent: toFixedNumber(trendPercent),
        instanceCount: overallInstances.size,
        volumeCount: overallVolumes.size,
        attachedInstanceCount: overallInstances.size,
        unattachedVolumeCount: unattachedVolumes.size,
        storageGb: toFixedNumber(storageGb),
        storageGbHours: toFixedNumber(storageGbHours),
        avgCpu: 0,
        totalNetworkGb: 0,
      };
      const table: Ec2ExplorerTable = {
        columns: [
          { key: "group", label: "Group" },
          { key: "volumeCount", label: "Volume Count" },
          { key: "instanceCount", label: "Instance Count" },
          { key: "storageGb", label: "Storage GB" },
          { key: "storageGbHours", label: "Storage GB-Hours" },
          { key: "volumeCost", label: "EBS Volume Cost" },
          { key: "storageCost", label: "Storage Cost" },
          { key: "ioCost", label: "PIOPS Cost" },
          { key: "throughputCost", label: "Throughput Cost" },
        ],
        rows: [...groups].map((group) => {
          const subset = filtered.filter((row) => (input.groupBy === "none" ? true : groupFor(row) === group));
          const volSet = new Set(subset.map((row) => row.volumeId));
          const instSet = new Set(subset.map((row) => row.attachedInstanceId).filter((v): v is string => Boolean(v)));
          const latestSizeByVolume = new Map<string, { date: string; sizeGb: number }>();
          for (const row of subset) {
            const current = latestSizeByVolume.get(row.volumeId);
            if (!current || row.date > current.date) latestSizeByVolume.set(row.volumeId, { date: row.date, sizeGb: row.sizeGb });
          }
          return {
            id: group,
            group,
            volumeCount: volSet.size,
            instanceCount: group === "Unattached" ? 0 : instSet.size,
            storageGb: toFixedNumber([...latestSizeByVolume.values()].reduce((sum, row) => sum + row.sizeGb, 0)),
            storageGbHours: toFixedNumber(subset.reduce((sum, row) => sum + row.sizeGb * 24, 0)),
            volumeCost: toFixedNumber(subset.reduce((sum, row) => sum + toEbsVolumeCost(row), 0)),
            storageCost: toFixedNumber(subset.reduce((sum, row) => sum + row.storageCost, 0)),
            ioCost: toFixedNumber(subset.reduce((sum, row) => sum + row.ioCost, 0)),
            throughputCost: toFixedNumber(subset.reduce((sum, row) => sum + row.throughputCost, 0)),
          };
        }),
      };
      if (input.groupBy === "instance") {
        const ebsByInstance = new Map<string, number>();
        for (const row of filtered) {
          const key = row.attachedInstanceName ?? row.attachedInstanceId ?? "Unattached";
          ebsByInstance.set(key, (ebsByInstance.get(key) ?? 0) + toEbsVolumeCost(row));
        }
        for (const [group, cost] of ebsByInstance.entries()) {
          const listed = table.rows.find((item) => String(item.group) === group);
          if (!listed) continue;
          const delta = Math.abs(Number(listed.volumeCost ?? 0) - cost);
          if (delta > 0.01) {
            logger.warn("EC2 explorer EBS reconciliation mismatch", {
              tenantId: input.scope.tenantId,
              group,
              volumeCost: Number(listed.volumeCost ?? 0),
              ebsCost: toFixedNumber(cost),
              delta: toFixedNumber(delta, 4),
              includedCategories: ["storage_cost", "io_cost", "throughput_cost"],
              excludedCategories: ["compute_cost", "snapshot_cost", "nat_gateway", "data_transfer_unrelated"],
            });
          }
        }
      }
      return { summary, graph: { type: input.groupBy === "none" ? "bar" : "stacked_bar", xKey: "date", series }, table };
    }
    if (input.costBasis === "amortized_cost" && !(await this.query.supportsAmortizedCost())) {
      logger.warn("EC2 explorer amortized cost basis requested but total_amortized_cost is unavailable; falling back to effective_cost", {
        tenantId: input.scope.tenantId,
      });
    }
    if (input.metric === "data_transfer") {
      const curRows = (await this.query.getCurCostRows(input)).filter((row) => row.category === "data_transfer");
      const view: "cost" | "usage" | "distribution" =
        input.usageType === "disk" ? "usage" : input.usageType === "cpu" ? "distribution" : "cost";
      const durationDays = dateRangeDaysInclusive(input.startDate, input.endDate);
      const previousRows = (await this.query.getCurCostRows({
        ...input,
        startDate: shiftDate(input.startDate, -durationDays),
        endDate: shiftDate(input.endDate, -durationDays),
      })).filter((row) => row.category === "data_transfer");
      const toTransferType = (row: CurCostRow): "internet" | "inter_region" | "inter_az" | "regional" | "unknown" =>
        classifyDataTransferSignals(row).transferType;
      const byGroup = new Map<string, { cost: number; usageGb: number; resources: Set<string> }>();
      const byDateGroup = new Map<string, Map<string, { cost: number; usageGb: number }>>();
      const unknownDiagnostics = new Map<string, {
        usageType: string;
        operation: string;
        productFamily: string;
        lineItemDescription: string;
        lineItemType: string;
        serviceCode: string;
        productCode: string;
        region: string;
        usageAmount: number;
        usageUnit: string;
        cost: number;
        resourceId: string;
        normalizedResourceId: string;
        dateBucket: string;
        likelyDemoData: boolean;
      }>();
      let unmappedResourceCost = 0;
      let unmappedResourceUsageGb = 0;
      const unmappedResourceKeys = new Set<string>();
      const unknownMappedResources = new Set<string>();
      let totalCost = 0;
      let totalUsage = 0;
      for (const row of curRows) {
        const classified = classifyDataTransferSignals(row);
        if (!classified.isDataTransferCandidate || classified.isNatGateway) continue;
        const transferType = classified.transferType;
        const date = bucketDate(row.date, input.granularity);
        const group =
          view === "distribution" ? transferType : groupForCurCostRow({ ...row, category: "data_transfer" }, input);
        const usageGb = row.usageQuantity;
        const mappedResourceId =
          row.instanceId
          ?? row.attachedInstanceId
          ?? toPossibleInstanceId(row.lineItemResourceId)
          ?? toPossibleInstanceId(row.lineItemDescription)
          ?? toPossibleInstanceId(row.usageType)
          ?? toPossibleInstanceId(row.productUsageType);
        if (!mappedResourceId) {
          unmappedResourceCost += row.cost;
          unmappedResourceUsageGb += usageGb;
          unmappedResourceKeys.add(
            [
              row.lineItemResourceId ?? "",
              row.lineItemDescription ?? "",
              row.usageType ?? "",
              row.productUsageType ?? "",
            ].join("::"),
          );
        }
        if (transferType === "unknown") {
          const usageType = row.usageType ?? "";
          const operation = row.operation ?? "";
          const productFamily = row.productFamily ?? "";
          const lineItemDescription = row.lineItemDescription ?? "";
          const lineItemType = row.lineItemType ?? "";
          const serviceCode = row.serviceName ?? "AmazonEC2";
          const productCode = row.serviceName ?? "AmazonEC2";
          const region = row.region ?? "Unknown";
          const usageAmount = Math.max(0, row.usageQuantity);
          const usageUnit = "GB";
          const resourceId = mappedResourceId ?? row.lineItemResourceId ?? "unmapped";
          const normalizedResourceId = mappedResourceId ?? "unmapped";
          const dateBucket = date;
          const likelyDemoData = (lineItemDescription.toLowerCase().includes("demo") || usageType.toLowerCase().includes("unknowndatatransfer"));
          const key = [
            usageType,
            operation,
            productFamily,
            lineItemDescription,
            lineItemType,
            serviceCode,
            productCode,
            region,
            resourceId,
            normalizedResourceId,
            dateBucket,
          ].join("::");
          const currentUnknown = unknownDiagnostics.get(key) ?? {
            usageType,
            operation,
            productFamily,
            lineItemDescription,
            lineItemType,
            serviceCode,
            productCode,
            region,
            usageAmount: 0,
            usageUnit,
            cost: 0,
            resourceId,
            normalizedResourceId,
            dateBucket,
            likelyDemoData,
          };
          currentUnknown.usageAmount += usageAmount;
          currentUnknown.cost += row.cost;
          unknownDiagnostics.set(key, currentUnknown);
        }
        const current = byGroup.get(group) ?? { cost: 0, usageGb: 0, resources: new Set<string>() };
        current.cost += row.cost;
        current.usageGb += usageGb;
        if (mappedResourceId) current.resources.add(mappedResourceId);
        byGroup.set(group, current);
        if (transferType === "unknown" && mappedResourceId) unknownMappedResources.add(mappedResourceId);
        totalCost += row.cost;
        totalUsage += usageGb;
        const dateMap = byDateGroup.get(date) ?? new Map<string, { cost: number; usageGb: number }>();
        const dateValue = dateMap.get(group) ?? { cost: 0, usageGb: 0 };
        dateValue.cost += row.cost;
        dateValue.usageGb += usageGb;
        dateMap.set(group, dateValue);
        byDateGroup.set(date, dateMap);
      }
      const previousCost = previousRows.reduce((sum, row) => sum + row.cost, 0);
      const trendPercent = previousCost > 0 ? ((totalCost - previousCost) / previousCost) * 100 : 0;
      const dates = [...byDateGroup.keys()].sort();
      const groups = [...new Set([...byDateGroup.values()].flatMap((m) => [...m.keys()]))];
      const graph: Ec2ExplorerGraph = {
        type: "stacked_bar",
        xKey: "date",
        series: groups.map((group) => ({
          key: group,
          label: metricLabel(group),
          data: dates.map((date) => {
            const bucket = byDateGroup.get(date);
            const point = bucket?.get(group) ?? { cost: 0, usageGb: 0 };
            const bucketTotalCost = [...(bucket?.values() ?? [])].reduce((sum, item) => sum + item.cost, 0);
            const cost = toFixedNumber(point.cost);
            const usageGb = toFixedNumber(point.usageGb);
            const percentShare = toFixedNumber(bucketTotalCost > 0 ? (point.cost / bucketTotalCost) * 100 : 0);
            const value = view === "usage" ? usageGb : view === "distribution" ? percentShare : cost;
            return {
              date,
              value: toFixedNumber(value),
              cost,
              total_cost: cost,
              data_transfer_cost: cost,
              usage_gb: usageGb,
              billed_usage_gb: usageGb,
              total_usage_gb: usageGb,
              percent_share: percentShare,
            };
          }),
        })),
      };
      const topTransferType = [...byGroup.entries()].sort((a, b) => b[1].cost - a[1].cost)[0]?.[0] ?? "unknown";
      const primaryColumn =
        view === "usage"
          ? { key: "usageGb", label: "Billed Usage GB" }
          : view === "distribution"
            ? { key: "pct", label: "% of Data Transfer" }
            : { key: "cost", label: "Cost" };
      const table: Ec2ExplorerTable = {
        columns: [
          { key: "transferType", label: "Transfer Type" },
          primaryColumn,
          ...(primaryColumn.key === "cost" ? [{ key: "usageGb", label: "Billed Usage GB" }, { key: "pct", label: "% of Data Transfer" }] : []),
          ...(primaryColumn.key === "usageGb" ? [{ key: "cost", label: "Cost" }, { key: "pct", label: "% of Data Transfer" }] : []),
          ...(primaryColumn.key === "pct" ? [{ key: "cost", label: "Cost" }, { key: "usageGb", label: "Billed Usage GB" }] : []),
          { key: "resourceCount", label: "Resource Count" },
          { key: "unmappedResourceCount", label: "Unmapped Resources" },
        ],
        rows: [...byGroup.entries()].map(([group, item]) => ({
          id: group,
          transferType: metricLabel(group),
          usageGb: toFixedNumber(item.usageGb),
          cost: toFixedNumber(item.cost),
          pct: toFixedNumber(totalCost > 0 ? (item.cost / totalCost) * 100 : 0),
          resourceCount: item.resources.size,
          unmappedResourceCount: group === "unknown" ? unmappedResourceKeys.size : 0,
        })).sort((a, b) => Number(b.cost) - Number(a.cost)),
      };
      logger.debug("EC2 explorer data-transfer view totals", {
        tenantId: input.scope.tenantId,
        selectedView: view,
        selectedValueKey: view === "usage" ? "usage_gb" : view === "distribution" ? "percent_share" : "cost",
        firstChartRow: graph.series[0]?.data[0] ?? null,
        chartTotal: toFixedNumber(
          graph.series.reduce(
            (sum, series) =>
              sum + series.data.reduce((inner, point) => inner + Number(point.value ?? 0), 0),
            0,
          ),
        ),
        kpiCost: toFixedNumber(totalCost),
        kpiUsageGb: toFixedNumber(totalUsage),
      });
      if (unknownDiagnostics.size > 0) {
        logger.debug("EC2 explorer data-transfer unknown diagnostics", {
          tenantId: input.scope.tenantId,
          unknownGroups: [...unknownDiagnostics.values()]
            .map((item) => ({
              usageType: item.usageType,
              operation: item.operation,
              productFamily: item.productFamily,
              lineItemDescription: item.lineItemDescription,
              lineItemType: item.lineItemType,
              serviceCode: item.serviceCode,
              productCode: item.productCode,
              region: item.region,
              usageAmount: toFixedNumber(item.usageAmount, 6),
              usageUnit: item.usageUnit,
              cost: toFixedNumber(item.cost, 6),
            }))
            .sort((a, b) => {
              if (b.cost !== a.cost) return b.cost - a.cost;
              return b.usageAmount - a.usageAmount;
            })
            .slice(0, 50),
        });
      }
      const topUnknownContributors = [...unknownDiagnostics.values()]
        .map((item) => ({
          usageType: item.usageType,
          operation: item.operation,
          productFamily: item.productFamily,
          lineItemDescription: item.lineItemDescription,
          lineItemType: item.lineItemType,
          serviceCode: item.serviceCode,
          productCode: item.productCode,
          region: item.region,
          usageAmount: toFixedNumber(item.usageAmount, 6),
          usageUnit: item.usageUnit,
          cost: toFixedNumber(item.cost, 6),
          resourceId: item.resourceId,
          normalizedResourceId: item.normalizedResourceId,
          dateBucket: item.dateBucket,
          likelyDemoData: item.likelyDemoData,
        }))
        .sort((a, b) => {
          if (b.cost !== a.cost) return b.cost - a.cost;
          return b.usageAmount - a.usageAmount;
        });
      return {
        summary: {
          totalCost: toFixedNumber(totalCost),
          previousCost: toFixedNumber(previousCost),
          trendPercent: toFixedNumber(trendPercent),
          instanceCount: new Set(curRows.map((r) => r.instanceId).filter(Boolean)).size,
          volumeCount: 0,
          attachedInstanceCount: 0,
          unattachedVolumeCount: 0,
          storageGb: toFixedNumber(totalUsage),
          storageGbHours: 0,
          avgCpu: 0,
          totalNetworkGb: metricLabel(topTransferType) === "Unknown" ? 0 : toFixedNumber(totalUsage),
        },
        graph,
        table,
        dataTransferDebug: input.debugDataTransfer
          ? {
              totalUnknownCost: toFixedNumber(byGroup.get("unknown")?.cost ?? 0),
              totalUnknownUsageGb: toFixedNumber(byGroup.get("unknown")?.usageGb ?? 0),
              unknownResourceCount: unknownMappedResources.size,
              unmappedResourceCount: unmappedResourceKeys.size,
              unmappedResourceCost: toFixedNumber(unmappedResourceCost),
              unmappedResourceUsageGb: toFixedNumber(unmappedResourceUsageGb),
              unknown_resource_count: unknownMappedResources.size,
              unmapped_resource_cost: toFixedNumber(unmappedResourceCost),
              unmapped_resource_usage_gb: toFixedNumber(unmappedResourceUsageGb),
              topUnknownContributors: topUnknownContributors.slice(0, 100),
              topUnknownRows: topUnknownContributors.slice(0, 100),
            }
          : undefined,
      };
    }
    if (input.metric === "cost") {
      const curRows = await this.query.getCurCostRows(input);
      const grouped = new Map<string, number>();
      const dated = new Map<string, Map<string, number>>();
      const categoryTotals = new Map<string, number>();
      let totalCost = 0;
      for (const row of curRows) {
        const group = groupForCurCostRow(row, input);
        if (input.groupValues.length > 0) {
          const selected = new Set(input.groupValues.map((v) => v.toLowerCase()));
          if (!selected.has(group.toLowerCase())) continue;
        }
        const date = bucketDate(row.date, input.granularity);
        totalCost += row.cost;
        grouped.set(group, (grouped.get(group) ?? 0) + row.cost);
        categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? 0) + row.cost);
        const byGroup = dated.get(date) ?? new Map<string, number>();
        byGroup.set(group, (byGroup.get(group) ?? 0) + row.cost);
        dated.set(date, byGroup);
      }

      const durationDays = dateRangeDaysInclusive(input.startDate, input.endDate);
      const previousRows = await this.query.getCurCostRows({
        ...input,
        startDate: shiftDate(input.startDate, -durationDays),
        endDate: shiftDate(input.endDate, -durationDays),
      });
      const previousCost = previousRows.reduce((sum, row) => sum + row.cost, 0);
      const trendPercent = previousCost > 0 ? ((totalCost - previousCost) / previousCost) * 100 : 0;

      const dates = [...dated.keys()].sort();
      const groups = [...new Set([...dated.values()].flatMap((m) => [...m.keys()]))].sort((a, b) => {
        if (a === "total") return -1;
        if (b === "total") return 1;
        return a.localeCompare(b);
      });
      const graph: Ec2ExplorerGraph = {
        type: input.groupBy === "none" ? "bar" : "stacked_bar",
        xKey: "date",
        series: groups.map((group) => ({
          key: group,
          label: group === "total" ? "Total Cost" : metricLabel(group),
          data: dates.map((date) => ({ date, value: toFixedNumber(dated.get(date)?.get(group) ?? 0) })),
        })),
      };

      const table: Ec2ExplorerTable = input.groupBy === "none"
        ? {
            columns: [
              { key: "totalCost", label: "Total Cost" },
              { key: "computeCost", label: "Compute Cost" },
              { key: "ebsCost", label: "EBS Cost" },
              { key: "snapshotCost", label: "Snapshot Cost" },
              { key: "dataTransferCost", label: "Data Transfer Cost" },
              { key: "eipCost", label: "EIP Cost" },
              { key: "natGatewayCost", label: "NAT Gateway Cost" },
              { key: "loadBalancerCost", label: "Load Balancer Cost" },
              { key: "otherCost", label: "Other Cost" },
            ],
            rows: [{
              id: "total",
              totalCost: toFixedNumber(totalCost),
              computeCost: toFixedNumber(categoryTotals.get("compute") ?? 0),
              ebsCost: toFixedNumber(categoryTotals.get("ebs") ?? 0),
              snapshotCost: toFixedNumber(categoryTotals.get("snapshot") ?? 0),
              dataTransferCost: toFixedNumber(categoryTotals.get("data_transfer") ?? 0),
              eipCost: toFixedNumber(categoryTotals.get("elastic_ip") ?? 0),
              natGatewayCost: toFixedNumber(categoryTotals.get("nat_gateway") ?? 0),
              loadBalancerCost: toFixedNumber(categoryTotals.get("load_balancer") ?? 0),
              otherCost: toFixedNumber(categoryTotals.get("other") ?? 0),
            }],
          }
        : {
            columns: input.groupBy === "cost_category"
              ? [
                  { key: "group", label: "Cost Category" },
                  { key: "totalCost", label: "Total Cost" },
                ]
              : [
                  { key: "group", label: "Group" },
                  { key: "totalCost", label: "Total Cost" },
                ],
            rows: [...grouped.entries()]
              .map(([group, cost]) => ({ id: `${input.groupBy}-${group}`, group, totalCost: toFixedNumber(cost) }))
              .sort((a, b) => Number(b.totalCost) - Number(a.totalCost)),
          };

      if (process.env.EC2_EXPLORER_COST_DEBUG === "true") {
        logger.info("EC2 explorer CUR cost debug", {
          tenantId: input.scope.tenantId,
          totalCurRowsScanned: curRows.length,
          groupedRowsCount: grouped.size,
          categoryTotals: Object.fromEntries([...categoryTotals.entries()].map(([k, v]) => [k, toFixedNumber(v)])),
          unmatchedOtherCost: toFixedNumber(categoryTotals.get("other") ?? 0),
          finalTotalCost: toFixedNumber(totalCost),
        });
        const otherRows = curRows.filter((r) => r.category === "other");
        const topOtherUsageTypes = new Map<string, number>();
        for (const row of otherRows) {
          const key = (row.usageType ?? "unknown").trim().toLowerCase() || "unknown";
          topOtherUsageTypes.set(key, (topOtherUsageTypes.get(key) ?? 0) + row.cost);
        }
        const top = [...topOtherUsageTypes.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([usageType, cost]) => ({ usageType, cost: toFixedNumber(cost) }));
        logger.info("EC2 explorer CUR cost uncategorized samples", {
          tenantId: input.scope.tenantId,
          samples: otherRows.slice(0, 20).map((r) => ({
            usageType: r.usageType,
            operation: r.operation,
            productFamily: r.productFamily,
            lineItemType: r.lineItemType,
            cost: toFixedNumber(r.cost, 6),
            chosenCategory: r.category,
          })),
          topOtherUsageTypes: top,
        });
      }

      return {
        summary: {
          totalCost: toFixedNumber(totalCost),
          previousCost: toFixedNumber(previousCost),
          trendPercent: toFixedNumber(trendPercent),
          instanceCount: new Set(curRows.map((r) => r.instanceId).filter(Boolean)).size,
          volumeCount: 0,
          attachedInstanceCount: new Set(curRows.map((r) => r.attachedInstanceId).filter(Boolean)).size,
          unattachedVolumeCount: 0,
          storageGb: 0,
          storageGbHours: 0,
          avgCpu: 0,
          totalNetworkGb: 0,
        },
        graph,
        table,
      };
    }
    const durationDays = dateRangeDaysInclusive(input.startDate, input.endDate);
    const previousStartDate = shiftDate(input.startDate, -durationDays);
    const previousEndDate = shiftDate(input.endDate, -durationDays);

    const [rows, previousRows, additionalDailyCosts, volumeRows] = await Promise.all([
      this.query.getFactRows(input),
      this.query.getFactRows({
        ...input,
        startDate: previousStartDate,
        endDate: previousEndDate,
      }),
      this.query.getAdditionalDailyCosts(input),
      this.query.getVolumeRows(input),
    ]);

    const additionalByDate = new Map(additionalDailyCosts.map((item) => [`${item.date}::${item.instanceId}`, item]));
    const normalizedRows = rows.map((row) => ({ ...row, date: bucketDate(row.date, input.granularity) }));
    const normalizedPreviousRows = previousRows.map((row) => ({ ...row, date: bucketDate(row.date, input.granularity) }));
    const groupedRows = applyGroupValueFilters(normalizedRows, input);
    const groupedPreviousRows = applyGroupValueFilters(normalizedPreviousRows, input);
    const filteredRows = applyInstancesThresholdFilters(groupedRows, input, additionalByDate);
    const filteredPreviousRows = applyInstancesThresholdFilters(groupedPreviousRows, input, additionalByDate);

    const summary = buildSummary(filteredRows, filteredPreviousRows, "effective_cost");

    let graph: Ec2ExplorerGraph;
    if (input.metric === "usage") {
      graph = buildUsageGraph(filteredRows, input);
    } else {
      graph = buildInstancesGraph(filteredRows, input);
    }

    let table: Ec2ExplorerTable;
    if (input.metric === "usage") {
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

  async getNetworkBreakdown(input: Ec2ExplorerInput): Promise<Ec2NetworkBreakdownResponse> {
    const payload = await this.query.getNetworkBreakdown(input);
    return {
      ...payload,
      note: "Breakdown is based on CUR line items and may differ slightly from EC2 daily rollup.",
    };
  }
}
