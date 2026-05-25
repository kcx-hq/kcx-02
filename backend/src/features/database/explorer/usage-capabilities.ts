export const USAGE_CAPABILITY_FAMILIES = [
  "compute_pressure",
  "connection_pressure",
  "io_activity",
  "throughput_activity",
  "storage_pressure",
] as const;

export const USAGE_METRICS = [
  "avg_cpu",
  "peak_cpu",
  "avg_connections",
  "peak_connections",
  "read_iops",
  "write_iops",
  "total_iops",
  "read_throughput",
  "write_throughput",
  "total_throughput",
  "storage_used_gb",
  "allocated_storage_gb",
] as const;

export type UsageCapabilityFamily = (typeof USAGE_CAPABILITY_FAMILIES)[number];
export type UsageMetric = (typeof USAGE_METRICS)[number];

export type UsageCapabilityMaturity = "high" | "medium" | "low";

export type UsageCapabilityDefinition = {
  id: UsageCapabilityFamily;
  label: string;
  maturity: UsageCapabilityMaturity;
  supportedServices: string[];
  supportedMetrics: UsageMetric[];
  defaultMetric: UsageMetric;
  unitDefaults: Partial<Record<UsageMetric, string>>;
};

const RDS_AURORA_SERVICES = [
  "Amazon RDS",
  "Amazon Aurora",
  "AmazonRDS",
  "Aurora",
  "AmazonRelationalDatabaseService",
] as const;

export const USAGE_CAPABILITY_REGISTRY: Record<UsageCapabilityFamily, UsageCapabilityDefinition> = {
  compute_pressure: {
    id: "compute_pressure",
    label: "Compute Pressure",
    maturity: "high",
    supportedServices: [...RDS_AURORA_SERVICES],
    supportedMetrics: ["avg_cpu", "peak_cpu"],
    defaultMetric: "avg_cpu",
    unitDefaults: {
      avg_cpu: "%",
      peak_cpu: "%",
    },
  },
  connection_pressure: {
    id: "connection_pressure",
    label: "Connection Pressure",
    maturity: "high",
    supportedServices: [...RDS_AURORA_SERVICES],
    supportedMetrics: ["avg_connections", "peak_connections"],
    defaultMetric: "avg_connections",
    unitDefaults: {
      avg_connections: "count",
      peak_connections: "count",
    },
  },
  io_activity: {
    id: "io_activity",
    label: "IO Activity",
    maturity: "medium",
    supportedServices: [...RDS_AURORA_SERVICES],
    supportedMetrics: ["read_iops", "write_iops", "total_iops"],
    defaultMetric: "total_iops",
    unitDefaults: {
      read_iops: "iops",
      write_iops: "iops",
      total_iops: "iops",
    },
  },
  throughput_activity: {
    id: "throughput_activity",
    label: "Throughput Activity",
    maturity: "medium",
    supportedServices: [...RDS_AURORA_SERVICES],
    supportedMetrics: ["read_throughput", "write_throughput", "total_throughput"],
    defaultMetric: "total_throughput",
    unitDefaults: {
      read_throughput: "bytes/s",
      write_throughput: "bytes/s",
      total_throughput: "bytes/s",
    },
  },
  storage_pressure: {
    id: "storage_pressure",
    label: "Storage Pressure",
    maturity: "high",
    supportedServices: [...RDS_AURORA_SERVICES],
    supportedMetrics: ["storage_used_gb", "allocated_storage_gb"],
    defaultMetric: "storage_used_gb",
    unitDefaults: {
      storage_used_gb: "GB",
      allocated_storage_gb: "GB",
    },
  },
};

export const isUsageCapabilityFamily = (value: string): value is UsageCapabilityFamily =>
  Object.prototype.hasOwnProperty.call(USAGE_CAPABILITY_REGISTRY, value);

export const isUsageMetric = (value: string): value is UsageMetric =>
  (USAGE_METRICS as readonly string[]).includes(value);

export const metricBelongsToFamily = (family: UsageCapabilityFamily, metric: UsageMetric): boolean =>
  USAGE_CAPABILITY_REGISTRY[family].supportedMetrics.includes(metric);
