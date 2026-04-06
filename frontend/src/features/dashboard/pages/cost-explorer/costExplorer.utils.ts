import type { DashboardSectionData } from "../../api/dashboardTypes";
import type { DatePreset, Granularity, Metric, TimeLabel } from "./costExplorer.types";

export const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

export const percentFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export const formatInputDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseInputDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addDays = (date: Date, count: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
};

const addHours = (date: Date, count: number): Date => {
  const next = new Date(date);
  next.setHours(next.getHours() + count);
  return next;
};

const addMonths = (date: Date, count: number): Date => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + count);
  return next;
};

const todayDate = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export const rangeByPreset = (preset: DatePreset): { from: string; to: string } => {
  const now = todayDate();
  if (preset === "last-7d") return { from: formatInputDate(addDays(now, -6)), to: formatInputDate(now) };
  if (preset === "last-30d") return { from: formatInputDate(addDays(now, -29)), to: formatInputDate(now) };
  if (preset === "mtd") return { from: formatInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: formatInputDate(now) };
  if (preset === "qtd") {
    const quarterStart = Math.floor(now.getMonth() / 3) * 3;
    return { from: formatInputDate(new Date(now.getFullYear(), quarterStart, 1)), to: formatInputDate(now) };
  }
  if (preset === "ytd") return { from: formatInputDate(new Date(now.getFullYear(), 0, 1)), to: formatInputDate(now) };
  return { from: formatInputDate(addDays(now, -29)), to: formatInputDate(now) };
};

export const parseMoneyToken = (raw?: string): number | null => {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase().replace(/[$,\s]/g, "");
  const match = normalized.match(/^(-?\d+(\.\d+)?)([kmb])?$/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = match[3];
  if (unit === "k") return value * 1_000;
  if (unit === "m") return value * 1_000_000;
  if (unit === "b") return value * 1_000_000_000;
  return value;
};

export const parsePercentToken = (raw?: string): number | null => {
  if (!raw) return null;
  const value = Number(raw.replace("%", ""));
  return Number.isFinite(value) ? value : null;
};

export const summaryToMap = (data?: DashboardSectionData): Record<string, string> => {
  const output: Record<string, string> = {};
  for (const item of data?.summary ?? []) {
    output[item.label] = item.value;
  }
  return output;
};

export const buildTimeLabels = (from: string, to: string, granularity: Granularity): TimeLabel[] => {
  const start = parseInputDate(from);
  const end = parseInputDate(to);
  if (!start || !end || start > end) return [];

  const labels: TimeLabel[] = [];

  if (granularity === "monthly") {
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const stop = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= stop) {
      labels.push({
        short: cursor.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        long: cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      });
      cursor = addMonths(cursor, 1);
    }
    return labels;
  }

  if (granularity === "daily") {
    let cursor = new Date(start);
    while (cursor <= end) {
      labels.push({
        short: cursor.toLocaleDateString("en-US", { month: "short", day: "2-digit" }),
        long: cursor.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      });
      cursor = addDays(cursor, 1);
    }
    return labels;
  }

  let cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const stop = new Date(end);
  stop.setHours(23, 0, 0, 0);
  while (cursor <= stop) {
    labels.push({
      short: cursor.toLocaleDateString("en-US", { month: "short", day: "2-digit", hour: "2-digit" }),
      long: cursor.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric" }),
    });
    cursor = addHours(cursor, 1);
  }

  return labels;
};

export const generatePrimaryValues = (
  count: number,
  monthlyBase: number,
  trendPct: number,
  granularity: Granularity,
  metric: Metric,
): number[] => {
  if (count === 0) return [];

  const unit =
    granularity === "monthly" ? monthlyBase : granularity === "daily" ? monthlyBase / 30 : monthlyBase / (30 * 24);
  const metricFactor = metric === "effective" ? 0.89 : 1;

  return Array.from({ length: count }, (_, idx) => {
    const ratio = count > 1 ? idx / (count - 1) : 0;
    const trend = 1 + (trendPct / 100) * ratio;
    const seasonality = 1 + Math.sin(idx / 3.2) * 0.08 + Math.cos(idx / 6.2) * 0.05;
    return Math.max(0, unit * metricFactor * trend * seasonality);
  });
};

export const shiftAsPreviousPeriod = (values: number[], granularity: Granularity): number[] => {
  const lag = granularity === "monthly" ? 1 : granularity === "daily" ? 30 : 24 * 30;
  return values.map((value, index) => values[index - lag] ?? Math.max(0, value * (0.94 + Math.sin(index / 5) * 0.015)));
};

export const sumValues = (values: number[]): number => values.reduce((total, value) => total + value, 0);

export const calculateDeltaPercent = (value: number, base: number): number => {
  if (base === 0) return 0;
  return ((value - base) / base) * 100;
};
