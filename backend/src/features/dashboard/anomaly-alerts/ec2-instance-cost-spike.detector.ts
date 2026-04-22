import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";

type Ec2InstanceDailyPoint = {
  usageDate: string;
  instanceId: string;
  actualCost: number;
  resourceKey: string | null;
  regionKey: string | null;
  subAccountKey: string | null;
};

export type Ec2InstanceCostSpikeCandidate = {
  usageDate: string;
  instanceId: string;
  anomalyType: "sudden_cost_spike" | "new_high_cost_instance" | "cost_drop";
  resourceKey: string | null;
  regionKey: string | null;
  subAccountKey: string | null;
  actualCost: number;
  expectedCost: number;
  deltaCost: number;
  deltaPercent: number;
  historyCount: number;
  severity: "low" | "medium" | "high";
};

export type Ec2InstanceCostSpikeGuardrails = {
  historyDaysRequired: number;
  minimumExpectedBaseline: number;
  minimumAbsoluteDelta: number;
  minimumPercentageDelta: number;
};

export type Ec2InstanceCostSpikeDetectionResult = {
  billingSourceId: string;
  cloudConnectionId: string | null;
  effectiveDateFrom: string | null;
  effectiveDateTo: string | null;
  historyWindowStart: string | null;
  historyWindowEnd: string | null;
  defaultedDateWindow: boolean;
  observedInstanceDaysInWindow: number;
  evaluatedInstanceDays: number;
  candidates: Ec2InstanceCostSpikeCandidate[];
  guardrails: Ec2InstanceCostSpikeGuardrails;
};

const BASELINE_WINDOW_DAYS = 7;
const MIN_HISTORY_DAYS_REQUIRED = 1;
const MINIMUM_EXPECTED_BASELINE = 0.1;
const MINIMUM_ABSOLUTE_DELTA = 0.25;
const MINIMUM_PERCENTAGE_DELTA = 0.5;
const MINIMUM_NEW_INSTANCE_COST = 1;
const NEW_INSTANCE_WARMUP_DAYS = 2;
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
  if (deltaPercent >= 4) return "high";
  if (deltaPercent >= 2) return "medium";
  return "low";
};

const fetchLatestUsageDate = async ({
  billingSourceId,
  cloudConnectionId,
  tenantId,
}: {
  billingSourceId: string;
  cloudConnectionId: string | null;
  tenantId: string | null;
}): Promise<string | null> => {
  const [row] = await sequelize.query<{ usage_date: string | null }>(
    `
      WITH combined AS (
        SELECT
          fed.usage_date
        FROM fact_ec2_instance_daily fed
        WHERE (
            (:cloudConnectionId IS NOT NULL AND fed.cloud_connection_id = CAST(:cloudConnectionId AS UUID))
            OR (:cloudConnectionId IS NULL AND fed.cloud_connection_id IS NULL)
          )
          AND fed.billing_source_id = CAST(:billingSourceId AS BIGINT)
          AND (:tenantId IS NULL OR fed.tenant_id = CAST(:tenantId AS UUID))
        UNION ALL
        SELECT
          ecd.usage_date
        FROM ec2_cost_history_daily ecd
        WHERE (
            (:cloudConnectionId IS NOT NULL AND ecd.cloud_connection_id = CAST(:cloudConnectionId AS UUID))
            OR (:cloudConnectionId IS NULL AND ecd.cloud_connection_id IS NULL)
          )
          AND ecd.billing_source_id = CAST(:billingSourceId AS BIGINT)
          AND (:tenantId IS NULL OR ecd.tenant_id = CAST(:tenantId AS UUID))
          AND ecd.charge_category = 'compute'
      )
      SELECT MAX(usage_date)::text AS usage_date
      FROM combined
    `,
    {
      replacements: { billingSourceId, cloudConnectionId, tenantId },
      type: QueryTypes.SELECT,
    },
  );

  return row?.usage_date ?? null;
};

const resolveEffectiveWindow = async ({
  billingSourceId,
  cloudConnectionId,
  tenantId,
  dateFrom,
  dateTo,
}: {
  billingSourceId: string;
  cloudConnectionId: string | null;
  tenantId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}): Promise<{ dateFrom: string | null; dateTo: string | null; defaulted: boolean }> => {
  if (dateFrom && dateTo) {
    return { dateFrom, dateTo, defaulted: false };
  }

  const latestUsageDate = await fetchLatestUsageDate({
    billingSourceId,
    cloudConnectionId,
    tenantId,
  });

  if (!latestUsageDate) {
    return { dateFrom: null, dateTo: null, defaulted: true };
  }

  const end = parseDateOnlyUtc(latestUsageDate);
  const start = addDaysUtc(end, -(DEFAULT_INCREMENTAL_TARGET_DAYS - 1));

  return {
    dateFrom: formatDateOnlyUtc(start),
    dateTo: formatDateOnlyUtc(end),
    defaulted: true,
  };
};

const fetchDailyPoints = async ({
  billingSourceId,
  cloudConnectionId,
  tenantId,
  fromDate,
  toDate,
}: {
  billingSourceId: string;
  cloudConnectionId: string | null;
  tenantId: string | null;
  fromDate: string;
  toDate: string;
}): Promise<Ec2InstanceDailyPoint[]> => {
  const rows = await sequelize.query<{
    usage_date: string;
    instance_id: string;
    actual_cost: string;
    resource_key: string | null;
    region_key: string | null;
    sub_account_key: string | null;
  }>(
    `
      WITH fact_points AS (
        SELECT
          fed.usage_date::text AS usage_date,
          fed.instance_id,
          COALESCE(fed.compute_cost, 0)::numeric(18,6) AS actual_cost,
          fed.resource_key::text AS resource_key,
          fed.region_key::text AS region_key,
          fed.sub_account_key::text AS sub_account_key
        FROM fact_ec2_instance_daily fed
        WHERE (
            (:cloudConnectionId IS NOT NULL AND fed.cloud_connection_id = CAST(:cloudConnectionId AS UUID))
            OR (:cloudConnectionId IS NULL AND fed.cloud_connection_id IS NULL)
          )
          AND fed.billing_source_id = CAST(:billingSourceId AS BIGINT)
          AND (:tenantId IS NULL OR fed.tenant_id = CAST(:tenantId AS UUID))
          AND fed.usage_date BETWEEN :fromDate AND :toDate
          AND fed.instance_id IS NOT NULL
          AND NULLIF(TRIM(fed.instance_id), '') IS NOT NULL
      ),
      fallback_points AS (
        SELECT
          ecd.usage_date::text AS usage_date,
          ecd.instance_id,
          COALESCE(
            SUM(
              CASE
                WHEN COALESCE(ecd.effective_cost, 0) > 0 THEN ecd.effective_cost
                ELSE COALESCE(ecd.billed_cost, 0)
              END
            ),
            0
          )::numeric(18,6) AS actual_cost,
          MIN(ecd.resource_key)::text AS resource_key,
          MIN(ecd.region_key)::text AS region_key,
          MIN(ecd.sub_account_key)::text AS sub_account_key
        FROM ec2_cost_history_daily ecd
        WHERE (
            (:cloudConnectionId IS NOT NULL AND ecd.cloud_connection_id = CAST(:cloudConnectionId AS UUID))
            OR (:cloudConnectionId IS NULL AND ecd.cloud_connection_id IS NULL)
          )
          AND ecd.billing_source_id = CAST(:billingSourceId AS BIGINT)
          AND (:tenantId IS NULL OR ecd.tenant_id = CAST(:tenantId AS UUID))
          AND ecd.usage_date BETWEEN :fromDate AND :toDate
          AND ecd.charge_category = 'compute'
          AND ecd.instance_id IS NOT NULL
          AND NULLIF(TRIM(ecd.instance_id), '') IS NOT NULL
        GROUP BY ecd.usage_date, ecd.instance_id
      ),
      combined AS (
        SELECT * FROM fact_points
        UNION ALL
        SELECT fp.*
        FROM fallback_points fp
        WHERE NOT EXISTS (
          SELECT 1
          FROM fact_points fx
          WHERE fx.usage_date = fp.usage_date
            AND fx.instance_id = fp.instance_id
        )
      )
      SELECT
        c.usage_date,
        c.instance_id,
        c.actual_cost::text AS actual_cost,
        c.resource_key,
        c.region_key,
        c.sub_account_key
      FROM combined c
      ORDER BY c.instance_id ASC, c.usage_date ASC
    `,
    {
      replacements: {
        billingSourceId,
        cloudConnectionId,
        tenantId,
        fromDate,
        toDate,
      },
      type: QueryTypes.SELECT,
    },
  );

  return rows.map((row) => ({
    usageDate: row.usage_date,
    instanceId: row.instance_id,
    actualCost: Number(row.actual_cost ?? 0),
    resourceKey: row.resource_key,
    regionKey: row.region_key,
    subAccountKey: row.sub_account_key,
  }));
};

export async function detectEc2InstanceCostSpikesForSource({
  billingSourceId,
  cloudConnectionId,
  tenantId,
  dateFrom,
  dateTo,
}: {
  billingSourceId: string;
  cloudConnectionId: string | null;
  tenantId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}): Promise<Ec2InstanceCostSpikeDetectionResult> {
  const effectiveWindow = await resolveEffectiveWindow({
    billingSourceId,
    cloudConnectionId,
    tenantId,
    dateFrom,
    dateTo,
  });

  if (!effectiveWindow.dateFrom || !effectiveWindow.dateTo) {
    return {
      billingSourceId,
      cloudConnectionId,
      effectiveDateFrom: null,
      effectiveDateTo: null,
      historyWindowStart: null,
      historyWindowEnd: null,
      defaultedDateWindow: effectiveWindow.defaulted,
      observedInstanceDaysInWindow: 0,
      evaluatedInstanceDays: 0,
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
  const targetFromDate = formatDateOnlyUtc(targetFrom);
  const targetToDate = formatDateOnlyUtc(targetTo);

  const points = await fetchDailyPoints({
    billingSourceId,
    cloudConnectionId,
    tenantId,
    fromDate: formatDateOnlyUtc(historyStart),
    toDate: targetToDate,
  });

  const pointsByInstance = new Map<string, Ec2InstanceDailyPoint[]>();
  for (const point of points) {
    const current = pointsByInstance.get(point.instanceId) ?? [];
    current.push(point);
    pointsByInstance.set(point.instanceId, current);
  }

  const candidates: Ec2InstanceCostSpikeCandidate[] = [];
  let observedInstanceDaysInWindow = 0;
  let evaluatedInstanceDays = 0;

  for (const instancePoints of pointsByInstance.values()) {
    const sortedPoints = [...instancePoints].sort((a, b) => a.usageDate.localeCompare(b.usageDate));

    for (let index = 0; index < sortedPoints.length; index += 1) {
      const point = sortedPoints[index];
      if (point.usageDate < targetFromDate || point.usageDate > targetToDate) {
        continue;
      }

      observedInstanceDaysInWindow += 1;

      const historicalValues = sortedPoints
        .slice(0, index)
        .map((value) => value.actualCost)
        .slice(-BASELINE_WINDOW_DAYS);

      if (historicalValues.length === 0) {
        if (point.actualCost < MINIMUM_NEW_INSTANCE_COST) {
          continue;
        }

        const deltaCost = point.actualCost;
        const deltaPercent = 1;

        candidates.push({
          usageDate: point.usageDate,
          instanceId: point.instanceId,
          anomalyType: "new_high_cost_instance",
          resourceKey: point.resourceKey,
          regionKey: point.regionKey,
          subAccountKey: point.subAccountKey,
          actualCost: point.actualCost,
          expectedCost: 0,
          deltaCost,
          deltaPercent,
          historyCount: 0,
          severity: mapSeverity(deltaPercent),
        });
        continue;
      }

      if (historicalValues.length < MIN_HISTORY_DAYS_REQUIRED) {
        continue;
      }

      evaluatedInstanceDays += 1;

      const expectedCost = median(historicalValues);
      const safeExpectedCost = Math.max(expectedCost, 0.01);
      const deltaCost = point.actualCost - expectedCost;
      const deltaPercent = deltaCost / safeExpectedCost;

      // New-instance warm-up classification:
      // if an instance is still in its first observed days and spikes, classify it as new_high_cost_instance
      // (instead of sudden_cost_spike) so the alert explicitly signals "new instance spend ramp-up".
      const isWarmupWindow = historicalValues.length <= NEW_INSTANCE_WARMUP_DAYS;
      if (isWarmupWindow) {
        if (
          point.actualCost >= MINIMUM_NEW_INSTANCE_COST &&
          deltaCost >= MINIMUM_ABSOLUTE_DELTA &&
          deltaPercent >= MINIMUM_PERCENTAGE_DELTA
        ) {
          candidates.push({
            usageDate: point.usageDate,
            instanceId: point.instanceId,
            anomalyType: "new_high_cost_instance",
            resourceKey: point.resourceKey,
            regionKey: point.regionKey,
            subAccountKey: point.subAccountKey,
            actualCost: point.actualCost,
            expectedCost,
            deltaCost,
            deltaPercent,
            historyCount: historicalValues.length,
            severity: mapSeverity(deltaPercent),
          });
        }
        continue;
      }

      if (expectedCost <= MINIMUM_EXPECTED_BASELINE) {
        continue;
      }

      const absoluteDeltaCost = Math.abs(deltaCost);
      const absoluteDeltaPercent = Math.abs(deltaPercent);

      if (absoluteDeltaCost < MINIMUM_ABSOLUTE_DELTA) {
        continue;
      }
      if (absoluteDeltaPercent < MINIMUM_PERCENTAGE_DELTA) {
        continue;
      }

      const anomalyType: Ec2InstanceCostSpikeCandidate["anomalyType"] =
        deltaCost >= 0 ? "sudden_cost_spike" : "cost_drop";

      candidates.push({
        usageDate: point.usageDate,
        instanceId: point.instanceId,
        anomalyType,
        resourceKey: point.resourceKey,
        regionKey: point.regionKey,
        subAccountKey: point.subAccountKey,
        actualCost: point.actualCost,
        expectedCost,
        deltaCost,
        deltaPercent: absoluteDeltaPercent,
        historyCount: historicalValues.length,
        severity: mapSeverity(absoluteDeltaPercent),
      });
    }
  }

  return {
    billingSourceId,
    cloudConnectionId,
    effectiveDateFrom: effectiveWindow.dateFrom,
    effectiveDateTo: effectiveWindow.dateTo,
    historyWindowStart: formatDateOnlyUtc(historyStart),
    historyWindowEnd: targetToDate,
    defaultedDateWindow: effectiveWindow.defaulted,
    observedInstanceDaysInWindow,
    evaluatedInstanceDays,
    candidates,
    guardrails: {
      historyDaysRequired: MIN_HISTORY_DAYS_REQUIRED,
      minimumExpectedBaseline: MINIMUM_EXPECTED_BASELINE,
      minimumAbsoluteDelta: MINIMUM_ABSOLUTE_DELTA,
      minimumPercentageDelta: MINIMUM_PERCENTAGE_DELTA,
    },
  };
}
