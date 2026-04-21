import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type {
  Ec2OverviewFilterOptions,
  Ec2OverviewKpis,
  Ec2OverviewQuery,
  Ec2OverviewTopCostlyInstance,
  Ec2OverviewTrendPoint,
} from "./ec2-overview.types.js";

type Ec2OverviewKpiRow = {
  totalInstances: number | string | null;
  runningInstances: number | string | null;
  stoppedInstances: number | string | null;
  idleInstances: number | string | null;
  underutilizedInstances: number | string | null;
  overutilizedInstances: number | string | null;
  totalComputeCost: number | string | null;
  totalInstanceHours: number | string | null;
};

type Ec2OverviewTrendRow = {
  date: string;
  runningInstanceCount: number | string | null;
  computeCost: number | string | null;
};

type Ec2OverviewTopCostlyRow = {
  instanceId: string;
  instanceName: string | null;
  instanceType: string | null;
  totalHours: number | string | null;
  computeCost: number | string | null;
  state: string | null;
};

type Ec2OverviewFilterOptionsRow = {
  instanceTypes: string[] | null;
  states: string[] | null;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const SCOPED_CTE = `
  WITH scoped AS (
    SELECT
      fed.usage_date,
      fed.instance_id,
      fed.instance_name,
      fed.instance_type,
      fed.state,
      fed.is_running,
      fed.is_idle_candidate,
      fed.is_underutilized_candidate,
      fed.is_overutilized_candidate,
      COALESCE(fed.total_hours, 0)::double precision AS total_hours,
      COALESCE(fed.compute_cost, 0)::double precision AS compute_cost
    FROM fact_ec2_instance_daily fed
    WHERE fed.tenant_id = :tenantId
      AND fed.usage_date >= :startDate::date
      AND fed.usage_date < (:endDate::date + INTERVAL '1 day')
      AND (:cloudConnectionId::uuid IS NULL OR fed.cloud_connection_id = :cloudConnectionId::uuid)
      AND (:subAccountKey::bigint IS NULL OR fed.sub_account_key = :subAccountKey::bigint)
      AND (:regionKey::bigint IS NULL OR fed.region_key = :regionKey::bigint)
      AND (:instanceType::text IS NULL OR fed.instance_type = :instanceType::text)
      AND (
        :state::text IS NULL
        OR LOWER(COALESCE(fed.state, CASE WHEN fed.is_running THEN 'running' ELSE 'stopped' END)) = :state::text
      )
  )
`;

export class Ec2OverviewRepository {
  async getKpis(input: Ec2OverviewQuery): Promise<Ec2OverviewKpis> {
    const rows = await sequelize.query<Ec2OverviewKpiRow>(
      `
        ${SCOPED_CTE},
        latest_instance AS (
          SELECT DISTINCT ON (s.instance_id)
            s.instance_id,
            LOWER(COALESCE(s.state, CASE WHEN s.is_running THEN 'running' ELSE 'stopped' END)) AS state_norm,
            s.is_running,
            s.is_idle_candidate,
            s.is_underutilized_candidate,
            s.is_overutilized_candidate
          FROM scoped s
          ORDER BY s.instance_id, s.usage_date DESC
        ),
        sums AS (
          SELECT
            COALESCE(SUM(s.total_hours), 0)::double precision AS total_instance_hours,
            COALESCE(SUM(s.compute_cost), 0)::double precision AS total_compute_cost
          FROM scoped s
        )
        SELECT
          COUNT(*)::bigint AS "totalInstances",
          COUNT(*) FILTER (WHERE li.is_running = TRUE OR li.state_norm = 'running')::bigint AS "runningInstances",
          COUNT(*) FILTER (
            WHERE li.state_norm IN ('stopped', 'stopping', 'terminated', 'shutting-down')
               OR (li.is_running = FALSE AND li.state_norm <> 'running')
          )::bigint AS "stoppedInstances",
          COUNT(*) FILTER (WHERE li.is_idle_candidate = TRUE)::bigint AS "idleInstances",
          COUNT(*) FILTER (WHERE li.is_underutilized_candidate = TRUE)::bigint AS "underutilizedInstances",
          COUNT(*) FILTER (WHERE li.is_overutilized_candidate = TRUE)::bigint AS "overutilizedInstances",
          (SELECT total_compute_cost FROM sums) AS "totalComputeCost",
          (SELECT total_instance_hours FROM sums) AS "totalInstanceHours"
        FROM latest_instance li;
      `,
      {
        replacements: input,
        type: QueryTypes.SELECT,
      },
    );

    const first = rows[0];
    if (!first) {
      return {
        totalInstances: 0,
        runningInstances: 0,
        stoppedInstances: 0,
        idleInstances: 0,
        underutilizedInstances: 0,
        overutilizedInstances: 0,
        totalComputeCost: 0,
        totalInstanceHours: 0,
      };
    }

    return {
      totalInstances: toNumber(first.totalInstances),
      runningInstances: toNumber(first.runningInstances),
      stoppedInstances: toNumber(first.stoppedInstances),
      idleInstances: toNumber(first.idleInstances),
      underutilizedInstances: toNumber(first.underutilizedInstances),
      overutilizedInstances: toNumber(first.overutilizedInstances),
      totalComputeCost: toNumber(first.totalComputeCost),
      totalInstanceHours: toNumber(first.totalInstanceHours),
    };
  }

  async getTrends(input: Ec2OverviewQuery): Promise<Ec2OverviewTrendPoint[]> {
    const rows = await sequelize.query<Ec2OverviewTrendRow>(
      `
        ${SCOPED_CTE}
        SELECT
          s.usage_date::text AS date,
          COUNT(*) FILTER (WHERE s.is_running = TRUE)::bigint AS "runningInstanceCount",
          COALESCE(SUM(s.compute_cost), 0)::double precision AS "computeCost"
        FROM scoped s
        GROUP BY s.usage_date
        ORDER BY s.usage_date ASC;
      `,
      {
        replacements: input,
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => ({
      date: row.date,
      runningInstanceCount: toNumber(row.runningInstanceCount),
      computeCost: toNumber(row.computeCost),
    }));
  }

  async getTopCostlyInstances(input: Ec2OverviewQuery, limit: number = 10): Promise<Ec2OverviewTopCostlyInstance[]> {
    const rows = await sequelize.query<Ec2OverviewTopCostlyRow>(
      `
        ${SCOPED_CTE},
        totals AS (
          SELECT
            s.instance_id,
            SUM(s.total_hours)::double precision AS total_hours,
            SUM(s.compute_cost)::double precision AS compute_cost
          FROM scoped s
          GROUP BY s.instance_id
        ),
        attrs AS (
          SELECT DISTINCT ON (s.instance_id)
            s.instance_id,
            s.instance_name,
            s.instance_type,
            LOWER(COALESCE(s.state, CASE WHEN s.is_running THEN 'running' ELSE 'stopped' END)) AS state_norm
          FROM scoped s
          ORDER BY s.instance_id, s.usage_date DESC
        )
        SELECT
          t.instance_id::text AS "instanceId",
          COALESCE(NULLIF(TRIM(COALESCE(a.instance_name, '')), ''), t.instance_id)::text AS "instanceName",
          a.instance_type::text AS "instanceType",
          t.total_hours::double precision AS "totalHours",
          t.compute_cost::double precision AS "computeCost",
          a.state_norm::text AS state
        FROM totals t
        LEFT JOIN attrs a
          ON a.instance_id = t.instance_id
        ORDER BY t.compute_cost DESC, t.total_hours DESC, t.instance_id ASC
        LIMIT :limit;
      `,
      {
        replacements: { ...input, limit },
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => ({
      instanceId: row.instanceId,
      instanceName: row.instanceName ?? row.instanceId,
      instanceType: row.instanceType ?? null,
      totalHours: toNumber(row.totalHours),
      computeCost: toNumber(row.computeCost),
      state: row.state ?? null,
    }));
  }

  async getFilterOptions(input: Ec2OverviewQuery): Promise<Ec2OverviewFilterOptions> {
    const rows = await sequelize.query<Ec2OverviewFilterOptionsRow>(
      `
        ${SCOPED_CTE}
        SELECT
          ARRAY(
            SELECT DISTINCT s.instance_type
            FROM scoped s
            WHERE s.instance_type IS NOT NULL
              AND NULLIF(TRIM(s.instance_type), '') IS NOT NULL
            ORDER BY s.instance_type
          ) AS "instanceTypes",
          ARRAY(
            SELECT DISTINCT LOWER(COALESCE(s.state, CASE WHEN s.is_running THEN 'running' ELSE 'stopped' END))
            FROM scoped s
            ORDER BY LOWER(COALESCE(s.state, CASE WHEN s.is_running THEN 'running' ELSE 'stopped' END))
          ) AS states;
      `,
      {
        replacements: input,
        type: QueryTypes.SELECT,
      },
    );

    const first = rows[0];
    return {
      instanceTypes: first?.instanceTypes ?? [],
      states: first?.states ?? [],
    };
  }
}

