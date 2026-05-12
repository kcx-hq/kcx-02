const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const NUMBER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const INTEGER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const PERCENT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const DATE = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const DASH = "-";

const asFinite = (value: unknown): number | null => {
  if (value === null || typeof value === "undefined") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const displayDash = (value: unknown): string => {
  if (value === null || typeof value === "undefined") return DASH;
  if (typeof value === "string" && value.trim().length === 0) return DASH;
  return String(value);
};

export const formatCurrency = (value: unknown): string => {
  const num = asFinite(value);
  return num === null ? DASH : CURRENCY.format(num);
};

export const formatNumber = (value: unknown): string => {
  const num = asFinite(value);
  return num === null ? DASH : NUMBER.format(num);
};

export const formatInteger = (value: unknown): string => {
  const num = asFinite(value);
  return num === null ? DASH : INTEGER.format(num);
};

export const formatPercent = (value: unknown): string => {
  const num = asFinite(value);
  return num === null ? DASH : `${PERCENT.format(num)}%`;
};

export const formatStorageGb = (value: unknown): string => {
  const num = asFinite(value);
  return num === null ? DASH : `${NUMBER.format(num)} GB`;
};

export const formatThroughput = (value: unknown): string => {
  const num = asFinite(value);
  if (num === null) return DASH;
  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  let current = num;
  let unit = units[0];
  for (let i = 1; i < units.length && current >= 1024; i += 1) {
    current /= 1024;
    unit = units[i];
  }
  return `${NUMBER.format(current)} ${unit}`;
};

export const formatDate = (value: unknown): string => {
  if (typeof value !== "string" || value.trim().length === 0) return DASH;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return DASH;
  return DATE.format(parsed);
};
