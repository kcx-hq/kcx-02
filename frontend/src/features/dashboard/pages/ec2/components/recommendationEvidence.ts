import type { Ec2RecommendationType } from "../../../api/dashboardTypes";

export type FormattedEvidenceRow = {
  key: string;
  label: string;
  value: string;
};

export type EvidenceItem = {
  label: string;
  value: string;
};

export type FormattedEvidence = {
  summary: string;
  rows: FormattedEvidenceRow[];
  parsed: boolean;
};

const FRIENDLY_KEYS: Record<string, string> = {
  state: "State",
  running_hours: "Running hours",
  avg_cpu: "Average CPU",
  max_cpu: "Maximum CPU",
  internet_transfer_cost: "Internet transfer cost",
  inter_az_transfer_cost: "Inter-AZ transfer cost",
  inter_region_transfer_cost: "Inter-region transfer cost",
  nat_gateway_cost: "NAT Gateway cost",
  usage_gb: "Usage",
  internet_usage_gb: "Internet usage",
  inter_az_usage_gb: "Inter-AZ usage",
  percent_of_network_cost: "Share of network cost",
  volume_state: "Volume state",
  volume_size_gb: "Volume size",
  snapshot_age_days: "Snapshot age",
  pricing_type: "Pricing type",
};

const MONEY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function toTitle(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function cleanText(value: unknown): string {
  if (value === null || typeof value === "undefined") return "-";
  return String(value).replace(/\s+/g, " ").trim();
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[$,%]/g, "").trim();
  if (!normalized || normalized === "null" || normalized === "undefined" || normalized === "NaN") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatValue(key: string, value: unknown): string {
  const numeric = toFiniteNumber(value);
  if (
    value === null ||
    typeof value === "undefined" ||
    value === "null" ||
    value === "undefined" ||
    value === "NaN" ||
    (typeof value === "number" && Number.isNaN(value))
  ) return "-";
  if (key.endsWith("_cost") && numeric !== null) return MONEY.format(numeric);
  if ((key.endsWith("_gb") || key.includes("usage_gb")) && numeric !== null) return `${NUMBER.format(numeric)} GB`;
  if ((key.includes("cpu") || key.includes("percent")) && numeric !== null) return `${NUMBER.format(numeric)}%`;
  if (key === "running_hours" && numeric !== null) return `${NUMBER.format(numeric)} hrs`;
  if (key === "snapshot_age_days" && numeric !== null) return `${NUMBER.format(numeric)} days`;
  return cleanText(value) || "-";
}

function parseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function parseKeyValueText(value: string): Record<string, unknown> | null {
  const entries = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) return null;
      const key = part.slice(0, separatorIndex).trim();
      const rawValue = part.slice(separatorIndex + 1).trim();
      return key ? [key, rawValue] as const : null;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry));

  if (entries.length === 0) return null;
  return Object.fromEntries(entries);
}

function normalizeEvidence(evidence: unknown): { data: Record<string, unknown> | null; text: string } {
  if (evidence && typeof evidence === "object" && !Array.isArray(evidence)) {
    return { data: evidence as Record<string, unknown>, text: "" };
  }
  const text = cleanText(evidence);
  if (!text || text === "-") return { data: null, text: "" };
  return { data: parseJson(text) ?? parseKeyValueText(text), text };
}

function getValue(data: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = formatValue(key, data[key]);
      return value === "-" ? null : value;
    }
  }
  return null;
}

function joinParts(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part !== "-")).join(" · ");
}

function labeledPart(label: string, value: string | null): string {
  return value ? `${label} ${value}` : label;
}

function compactFallback(text: string): string {
  const compact = text
    .replace(/([a-z0-9_]+)=/gi, (_, key: string) => `${toTitle(key)} `)
    .replace(/\s*,\s*/g, " · ")
    .replace(/\b(null|undefined|NaN)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return compact.length > 110 ? `${compact.slice(0, 109)}...` : compact || "-";
}

function buildSummary(type: Ec2RecommendationType | string, data: Record<string, unknown> | null, fallbackText: string): string {
  if (!data) return compactFallback(fallbackText);

  if (type === "idle_instance") {
    return joinParts([labeledPart("Running", getValue(data, "running_hours")), labeledPart("Avg CPU", getValue(data, "avg_cpu"))]);
  }
  if (type === "underutilized_instance") {
    return joinParts([labeledPart("Avg CPU", getValue(data, "avg_cpu")), labeledPart("Running", getValue(data, "running_hours"))]);
  }
  if (type === "overutilized_instance") {
    return joinParts([labeledPart("Avg CPU", getValue(data, "avg_cpu")), labeledPart("Max CPU", getValue(data, "max_cpu"))]);
  }
  if (type === "high_internet_data_transfer") {
    return joinParts([labeledPart("Internet transfer", getValue(data, "internet_transfer_cost")), getValue(data, "internet_usage_gb", "usage_gb")]);
  }
  if (type === "high_inter_az_data_transfer") {
    return joinParts([labeledPart("Inter-AZ transfer", getValue(data, "inter_az_transfer_cost")), getValue(data, "inter_az_usage_gb", "usage_gb")]);
  }
  if (type === "high_inter_region_data_transfer") {
    return joinParts([labeledPart("Inter-region transfer", getValue(data, "inter_region_transfer_cost")), getValue(data, "inter_region_usage_gb", "usage_gb")]);
  }
  if (type === "high_nat_gateway_cost") {
    return joinParts([labeledPart("NAT Gateway cost", getValue(data, "nat_gateway_cost"))]);
  }
  if (type === "unattached_volume") {
    return joinParts(["Volume unattached", getValue(data, "volume_size_gb")]);
  }
  if (type === "old_snapshot") {
    const age = getValue(data, "snapshot_age_days");
    return age ? `Snapshot age ${age}` : compactFallback(fallbackText);
  }
  if (type === "orphaned_snapshot") {
    const age = getValue(data, "snapshot_age_days");
    return age ? `Orphaned snapshot · ${age} old` : "Orphaned snapshot";
  }
  if (type === "uncovered_on_demand") {
    return joinParts([getValue(data, "pricing_type") ?? "On-Demand", labeledPart("Running", getValue(data, "running_hours"))]);
  }

  const rows = Object.entries(data)
    .slice(0, 3)
    .map(([key, value]) => {
      const formatted = formatValue(key, value);
      return formatted === "-" ? null : `${FRIENDLY_KEYS[key] ?? toTitle(key)} ${formatted}`;
    });
  return joinParts(rows) || compactFallback(fallbackText);
}

function formatEvidence(type: Ec2RecommendationType | string, evidence: unknown): FormattedEvidence {
  const { data, text } = normalizeEvidence(evidence);
  const rows = data
    ? Object.entries(data)
        .map(([key, value]) => ({
          key,
          label: FRIENDLY_KEYS[key] ?? toTitle(key),
          value: formatValue(key, value),
        }))
        .filter((row) => row.value !== "-")
    : [];

  return {
    summary: buildSummary(type, data, text),
    rows,
    parsed: Boolean(data),
  };
}

export function formatRecommendationEvidence(evidence: string | null | undefined): EvidenceItem[];
export function formatRecommendationEvidence(type: Ec2RecommendationType | string, evidence: unknown): FormattedEvidence;
export function formatRecommendationEvidence(
  typeOrEvidence: Ec2RecommendationType | string | null | undefined,
  maybeEvidence?: unknown,
): EvidenceItem[] | FormattedEvidence {
  if (arguments.length === 1) {
    const formatted = formatEvidence("generic", typeOrEvidence);
    if (formatted.rows.length > 0) {
      return formatted.rows.map((row) => ({ label: row.label, value: row.value }));
    }
    return formatted.summary === "-" ? [] : [{ label: "Evidence", value: formatted.summary }];
  }
  return formatEvidence(typeOrEvidence ?? "generic", maybeEvidence);
}
