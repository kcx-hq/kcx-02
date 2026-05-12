import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";

type DailyTotalCostPoint = {
  usageDate: string;
  totalCost: number;
};

export type DailyTotalCostSpikeCandidate = {
  usageDate: string;
  actualCost: number;
  expectedCost: number;
  deltaCost: number;
  deltaPercent: number;
  historyCount: number;
  severity: "low" | "medium" | "high";
};

export type DailyTotalCostSpikeGuardrails = {
  historyDaysRequired: number;
  minimumExpectedBaseline: number;
  minimumAbsoluteDelta: number;
  minimumPercentageDelta: number;
};

export type DailyTotalCostSpikeDetectionResult = {
  billingSourceId: string;
  effectiveDateFrom: string | null;
  effectiveDateTo: string | null;
  historyWindowStart: string | null;
  historyWindowEnd: string | null;
  defaultedDateWindow: boolean;
  evaluatedDays: number;
  observedDaysInWindow: number;
  candidates: DailyTotalCostSpikeCandidate[];
  guardrails: DailyTotalCostSpikeGuardrails;
};

const BASELINE_WINDOW_DAYS = 7;
const MIN_HISTORY_DAYS_REQUIRED = 1;
const MINIMUM_EXPECTED_BASELINE = 25;
const MINIMUM_ABSOLUTE_DELTA = 50;
const MINIMUM_PERCENTAGE_DELTA = 0.35;
const DEFAULT_INCREMENTAL_TARGET_DAYS = 1;

const parseDateOnlyUtc = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const formatDateOnlyUtc = (value: Date): string => value.toISOString().slice(0, 10);

const addDaysUtc = (value: Date, deltaDays: number): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + deltaDays);
  return next;
};

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
};

const mapSeverity = (deltaPercent: number): "low" | "medium" | "high" => {
  if (deltaPercent >= 1) return "high";
  if (deltaPercent >= 0.5) return "medium";
  return "low";
};

const fetchLatestUsageDate = async (billingSourceId: string): Promise<string | null> => {
  const [row] = await sequelize.query<{ usage_date: string | null }>(
    `
      SELECT MAX(acd.usage_date)::text AS usage_date
      FROM agg_cost_daily acd
      WHERE acd.billing_source_id = CAST(:billingSourceId AS BIGINT)
    `,
    {
      replacements: { billingSourceId },
      type: QueryTypes.SELECT,
    },
  );

  return row?.usage_date ?? null;
};

const resolveEffectiveWindow = async ({
  billingSourceId,
  dateFrom,
  dateTo,
}: {
  billingSourceId: string;
  dateFrom: string | null;
  dateTo: string | null;
}): Promise<{ dateFrom: string | null; dateTo: string | null; defaulted: boolean }> => {
  if (dateFrom && dateTo) {
    return { dateFrom, dateTo, defaulted: false };
  }

  const latestUsageDate = await fetchLatestUsageDate(billingSourceId);
  if (!latestUsageDate) {
    return { dateFrom: null, dateTo: null, defaulted: true };
  }

  // Phase 5 incremental default when no explicit range is available: evaluate the latest day only.
  const end = parseDateOnlyUtc(latestUsageDate);
  const start = addDaysUtc(end, -(DEFAULT_INCREMENTAL_TARGET_DAYS - 1));

  return {
    dateFrom: formatDateOnlyUtc(start),
    dateTo: formatDateOnlyUtc(end),
    defaulted: true,
  };
};

const fetchDailyTotals = async ({
  billingSourceId,
  fromDate,
  toDate,
}: {
  billingSourceId: string;
  fromDate: string;
  toDate: string;
}): Promise<DailyTotalCostPoint[]> => {
  const rows = await sequelize.query<{ usage_date: string; total_cost: string }>(
    `
      SELECT
        acd.usage_date::text AS usage_date,
        COALESCE(SUM(acd.billed_cost), 0)::text AS total_cost
      FROM agg_cost_daily acd
      WHERE acd.billing_source_id = CAST(:billingSourceId AS BIGINT)
        AND acd.usage_date BETWEEN :fromDate AND :toDate
      GROUP BY acd.usage_date
      ORDER BY acd.usage_date ASC
    `,
    {
      replacements: {
        billingSourceId,
        fromDate,
        toDate,
      },
      type: QueryTypes.SELECT,
    },
  );

  return rows.map((row) => ({
    usageDate: row.usage_date,
    totalCost: Number(row.total_cost ?? 0),
  }));
};

export async function detectDailyTotalCostSpikesForSource({
  billingSourceId,
  dateFrom,
  dateTo,
}: {
  billingSourceId: string;
  dateFrom: string | null;
  dateTo: string | null;
}): Promise<DailyTotalCostSpikeDetectionResult> {
  const effectiveWindow = await resolveEffectiveWindow({
    billingSourceId,
    dateFrom,
    dateTo,
  });

  if (!effectiveWindow.dateFrom || !effectiveWindow.dateTo) {
    return {
      billingSourceId,
      effectiveDateFrom: null,
      effectiveDateTo: null,
      historyWindowStart: null,
      historyWindowEnd: null,
      defaultedDateWindow: effectiveWindow.defaulted,
      evaluatedDays: 0,
      observedDaysInWindow: 0,
      candidates: [],
      guardrails: {
        historyDaysRequired: MIN_HISTORY_DAYS_REQUIRED,
        minimumExpectedBaseline: MINIMUM_EXPECTED_BASELINE,
        minimumAbsoluteDelta: MINIMUM_ABSOLUTE_DELTA,
        minimumPercentageDelta: MINIMUM_PERCENTAGE_DELTA,
      },
    };
  }

  const targetFrom = parseDateOnlyUtc(effectiveWindow.dateFrom);
  const targetTo = parseDateOnlyUtc(effectiveWindow.dateTo);
  const historyStart = addDaysUtc(targetFrom, -BASELINE_WINDOW_DAYS);

  const points = await fetchDailyTotals({
    billingSourceId,
    fromDate: formatDateOnlyUtc(historyStart),
    toDate: formatDateOnlyUtc(targetTo),
  });

  const pointsByDate = new Map<string, number>(points.map((point) => [point.usageDate, point.totalCost]));

  const sortedPoints = [...points].sort((a, b) => a.usageDate.localeCompare(b.usageDate));
  const candidates: DailyTotalCostSpikeCandidate[] = [];

  let evaluatedDays = 0;
  let observedDaysInWindow = 0;

  for (let cursor = new Date(targetFrom); cursor <= targetTo; cursor = addDaysUtc(cursor, 1)) {
    const candidateDate = formatDateOnlyUtc(cursor);
    if (!pointsByDate.has(candidateDate)) {
      continue;
    }

    observedDaysInWindow += 1;

    const historicalValues = sortedPoints
      .filter((point) => point.usageDate < candidateDate)
      .map((point) => point.totalCost)
      .slice(-BASELINE_WINDOW_DAYS);

    if (historicalValues.length < MIN_HISTORY_DAYS_REQUIRED) {
      continue;
    }

    evaluatedDays += 1;

    const expectedCost = median(historicalValues);
    if (expectedCost <= MINIMUM_EXPECTED_BASELINE) {
      continue;
    }

    const actualCost = pointsByDate.get(candidateDate) ?? 0;
    const deltaCost = actualCost - expectedCost;

    if (deltaCost <= 0) {
      continue;
    }

    const deltaPercent = expectedCost > 0 ? deltaCost / expectedCost : 0;

    if (deltaCost < MINIMUM_ABSOLUTE_DELTA) {
      continue;
    }

    if (deltaPercent < MINIMUM_PERCENTAGE_DELTA) {
      continue;
    }

    candidates.push({
      usageDate: candidateDate,
      actualCost,
      expectedCost,
      deltaCost,
      deltaPercent,
      historyCount: historicalValues.length,
      severity: mapSeverity(deltaPercent),
    });
  }

  return {
    billingSourceId,
    effectiveDateFrom: effectiveWindow.dateFrom,
    effectiveDateTo: effectiveWindow.dateTo,
    historyWindowStart: formatDateOnlyUtc(historyStart),
    historyWindowEnd: formatDateOnlyUtc(targetTo),
    defaultedDateWindow: effectiveWindow.defaulted,
    evaluatedDays,
    observedDaysInWindow,
    candidates,
    guardrails: {
      historyDaysRequired: MIN_HISTORY_DAYS_REQUIRED,
      minimumExpectedBaseline: MINIMUM_EXPECTED_BASELINE,
      minimumAbsoluteDelta: MINIMUM_ABSOLUTE_DELTA,
      minimumPercentageDelta: MINIMUM_PERCENTAGE_DELTA,
    },
  };
}
