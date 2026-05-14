const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const INTEGER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const DATE = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const PERCENT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export const formatInteger = (value: unknown): string => {
  const num = Number(value);
  return Number.isFinite(num) ? INTEGER.format(num) : "0";
};

export const formatCurrency = (value: unknown): string => {
  const num = Number(value);
  return Number.isFinite(num) ? CURRENCY.format(num) : "Not estimated";
};

export const formatDate = (value: string | null): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return DATE.format(parsed);
};

export const recommendationTypeLabel = (value: string | null): string => {
  switch (value) {
    case "DB_STORAGE_OPTIMIZATION":
      return "Storage Optimization";
    case "DB_IDLE_CANDIDATE":
      return "Idle Candidate";
    case "DB_HA_COST_OPTIMIZATION":
      return "HA Cost Optimization";
    case "DB_ENGINE_DEPLOYMENT_OPTIMIZATION":
      return "Engine / Deployment Optimization";
    case "DB_RIGHTSIZING_CANDIDATE":
      return "Rightsizing Candidate";
    default:
      return value ?? "-";
  }
};

export const confidenceLabel = (value: string | null): string => {
  if (!value) return "-";
  const normalized = value.toLowerCase();
  if (normalized === "low") return "Low";
  if (normalized === "medium") return "Medium";
  if (normalized === "high") return "High";
  return value;
};

export const evidenceLabel = (value: string | null): string => {
  if (!value) return "-";
  if (value === "billing_only") return "Billing Only";
  if (value === "inventory_backed") return "Inventory Backed";
  if (value === "telemetry_backed") return "Telemetry Backed";
  return value;
};

export const statusLabel = (value: string | null): string => {
  if (!value) return "-";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => (part.length > 0 ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
};

export const formatPercent = (value: unknown): string => {
  const num = Number(value);
  return Number.isFinite(num) ? `${PERCENT.format(num)}%` : "Not available";
};
