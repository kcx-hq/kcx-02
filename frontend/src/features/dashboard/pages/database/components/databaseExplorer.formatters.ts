const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const CURRENCY_COMPACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const NUMBER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const NUMBER_COMPACT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const INTEGER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const PERCENT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export const NULL_MARKER = "—";

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || typeof value === "undefined") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const formatCurrency = (value: unknown): string => {
  const parsed = toFiniteNumber(value);
  return parsed === null ? NULL_MARKER : CURRENCY.format(parsed);
};

export const formatCompactCurrency = (value: unknown): string => {
  const parsed = toFiniteNumber(value);
  return parsed === null ? NULL_MARKER : CURRENCY_COMPACT.format(parsed);
};

export const formatNumber = (value: unknown, suffix = ""): string => {
  const parsed = toFiniteNumber(value);
  return parsed === null ? NULL_MARKER : `${NUMBER.format(parsed)}${suffix}`;
};

export const formatCompactNumber = (value: unknown): string => {
  const parsed = toFiniteNumber(value);
  return parsed === null ? NULL_MARKER : NUMBER_COMPACT.format(parsed);
};

export const formatInteger = (value: unknown): string => {
  const parsed = toFiniteNumber(value);
  return parsed === null ? NULL_MARKER : INTEGER.format(parsed);
};

export const formatPercentFromRatio = (value: unknown): string => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return NULL_MARKER;
  const pct = parsed * 100;
  return `${pct >= 0 ? "+" : ""}${PERCENT.format(pct)}%`;
};

export const asFiniteOrZero = (value: unknown): number => {
  const parsed = toFiniteNumber(value);
  return parsed ?? 0;
};
