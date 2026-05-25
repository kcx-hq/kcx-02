export const DETAIL_EMPTY_NOTE = "—";
export const DETAIL_SECTION_EMPTY_NOTE = "Data is not available for the selected range.";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) {
    return DETAIL_EMPTY_NOTE;
  }
  return currencyFormatter.format(value);
};

export const formatNumber = (value: number | null | undefined, suffix = ""): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) {
    return DETAIL_EMPTY_NOTE;
  }
  return `${decimalFormatter.format(value)}${suffix}`;
};

export const formatInteger = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) {
    return DETAIL_EMPTY_NOTE;
  }
  return integerFormatter.format(value);
};

export const formatPercent = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) {
    return DETAIL_EMPTY_NOTE;
  }
  return `${decimalFormatter.format(value)}%`;
};

export const formatBytes = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) {
    return DETAIL_EMPTY_NOTE;
  }
  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  let current = value;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${decimalFormatter.format(current)} ${units[unitIndex]}`;
};

export const formatDateRange = (startDate: string | null, endDate: string | null): string => {
  if (!startDate || !endDate) {
    return DETAIL_EMPTY_NOTE;
  }
  return `${startDate} to ${endDate}`;
};

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return DETAIL_EMPTY_NOTE;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US");
};

export const formatDateOnly = (value: string | null | undefined): string => {
  if (!value) return DETAIL_EMPTY_NOTE;
  return value.slice(0, 10);
};

export const displayValue = (value: string | null | undefined): string => {
  if (!value || value.trim().length === 0) {
    return DETAIL_EMPTY_NOTE;
  }
  return value;
};

export const toTitleCase = (value: string | null | undefined): string => {
  if (!value || value.trim().length === 0) {
    return DETAIL_EMPTY_NOTE;
  }
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

export const getActivitySignal = (params: {
  avgLoad: number | null;
  avgCpu: number | null;
  avgConnections: number | null;
  requestCount: number | null;
}): string => {
  const { avgLoad, avgCpu, avgConnections, requestCount } = params;
  if (avgLoad === null && avgCpu === null && avgConnections === null && requestCount === null) {
    return DETAIL_EMPTY_NOTE;
  }
  if ((avgLoad ?? 0) > 5 || (avgCpu ?? 0) > 60 || (avgConnections ?? 0) > 100) {
    return "High activity";
  }
  if ((avgLoad ?? 0) > 1 || (avgCpu ?? 0) > 20 || (avgConnections ?? 0) > 20 || (requestCount ?? 0) > 0) {
    return "Steady activity";
  }
  return "Light activity";
};

export const getResourceFootprint = (params: {
  allocatedStorageGb: number | null;
  dataFootprintGb: number | null;
  instanceClass: string | null;
  resourceType: string | null;
}): string => {
  const parts = [
    params.instanceClass?.trim(),
    params.resourceType?.trim(),
    params.allocatedStorageGb !== null ? `${decimalFormatter.format(params.allocatedStorageGb)} GB allocated` : null,
    params.dataFootprintGb !== null ? `${decimalFormatter.format(params.dataFootprintGb)} GB footprint` : null,
  ].filter((part): part is string => Boolean(part && part.length > 0));

  return parts.length > 0 ? parts.join(" • ") : DETAIL_EMPTY_NOTE;
};

export const getWorkloadLabel = (params: {
  avgLoad: number | null;
  avgConnections: number | null;
  requestCount: number | null;
}): string => {
  const { avgLoad, avgConnections, requestCount } = params;
  if (avgLoad === null && avgConnections === null && requestCount === null) {
    return DETAIL_EMPTY_NOTE;
  }
  if ((avgLoad ?? 0) >= 5 || (avgConnections ?? 0) >= 100) return "Concurrency-heavy";
  if ((requestCount ?? 0) > 0 && (avgConnections ?? 0) < 20) return "Request-driven";
  if ((avgLoad ?? 0) < 1 && (avgConnections ?? 0) < 10) return "Light background workload";
  return "Balanced operational workload";
};

export const hasMetricValue = (...values: Array<number | null | undefined>): boolean =>
  values.some((value) => value !== null && typeof value !== "undefined" && Number.isFinite(value));

export const isRdsAuroraService = (dbService: string | null | undefined, dbEngine: string | null | undefined): boolean => {
  const service = (dbService ?? "").toLowerCase();
  const engine = (dbEngine ?? "").toLowerCase();
  return service.includes("rds") || service.includes("aurora") || engine.includes("aurora");
};

