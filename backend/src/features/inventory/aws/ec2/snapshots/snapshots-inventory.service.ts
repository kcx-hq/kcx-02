import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../../models/index.js";
import type {
  InventoryEc2SnapshotsListItem,
  InventoryEc2SnapshotsListQuery,
  InventoryEc2SnapshotsListResponse,
  InventoryEc2SnapshotsSignal,
  InventoryEc2SnapshotsSummary,
} from "./snapshots-inventory.types.js";

const OLD_SNAPSHOT_AGE_DAYS = 30;
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

type InventoryRow = {
  snapshotId: string;
  sourceVolumeId: string | null;
  sourceInstanceId: string | null;
  state: string | null;
  storageTier: string | null;
  encrypted: boolean | null;
  kmsKeyId: string | null;
  progress: string | null;
  startTime: Date | string | null;
  regionKey: string | null;
  subAccountKey: string | null;
  tags: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  cloudConnectionId: string | null;
};

type InventoryCountRow = {
  total: string;
};

type InventoryWhereClause = {
  clause: string;
  bind: unknown[];
  nextIndex: number;
};

type SourceVolumeRow = {
  cloudConnectionId: string | null;
  regionKey: string | null;
  sourceVolumeId: string;
  sourceVolumeName: string;
};

type SourceInstanceRow = {
  cloudConnectionId: string | null;
  regionKey: string | null;
  sourceInstanceId: string;
  sourceInstanceName: string;
};

type SnapshotCostRow = {
  snapshotId: string;
  cost: number | string | null;
  currencyCode: string | null;
};

type SnapshotSummaryRow = {
  snapshotsInView: string;
  likelyOrphanedCount: string;
  oldSnapshotsCount: string;
  totalSnapshotCost: number | string | null;
};

type SnapshotCost = {
  cost: number | null;
  currencyCode: string | null;
};

const normalizeLower = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

const toIsoOrNull = (value: Date | string | null): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toNullableNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || typeof value === "undefined") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIntOrZero = (value: number | string | null | undefined): number => {
  const parsed = toNullableNumber(value);
  if (parsed === null) return 0;
  return Math.trunc(parsed);
};

const toConnectionResourceKey = (
  cloudConnectionId: string | null,
  resourceId: string,
): string => `${cloudConnectionId ?? ""}::${resourceId}`;

const toScopedResourceKey = (
  cloudConnectionId: string | null,
  regionKey: string | null,
  resourceId: string,
): string => `${cloudConnectionId ?? ""}::${regionKey ?? ""}::${resourceId}`;

const computeAgeDays = (startTime: Date | string | null, nowMs: number): number | null => {
  if (!startTime) return null;
  const parsed =
    startTime instanceof Date ? startTime.getTime() : new Date(startTime).getTime();
  if (Number.isNaN(parsed)) return null;
  if (parsed > nowMs) return 0;
  return Math.floor((nowMs - parsed) / MILLIS_PER_DAY);
};

const computeSignal = (input: {
  likelyOrphaned: boolean;
  ageDays: number | null;
}): InventoryEc2SnapshotsSignal => {
  if (input.likelyOrphaned) return "Orphaned";
  if (input.ageDays !== null && input.ageDays >= OLD_SNAPSHOT_AGE_DAYS) return "Old";
  return "Normal";
};

export class SnapshotsInventoryService {
  async listSnapshots(input: {
    tenantId: string;
    query: InventoryEc2SnapshotsListQuery;
  }): Promise<InventoryEc2SnapshotsListResponse> {
    const page = input.query.page;
    const pageSize = input.query.pageSize;

    const where = this.buildInventoryWhereClause(input);

    const [{ total, rows }, summary] = await Promise.all([
      this.loadInventoryPage({
        query: input.query,
        where,
      }),
      this.loadSummary({
        where,
      }),
    ]);

    if (rows.length === 0) {
      return {
        items: [],
        summary,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
        },
      };
    }

    const sourceVolumeIds = Array.from(
      new Set(
        rows
          .map((row) => row.sourceVolumeId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const sourceInstanceIds = Array.from(
      new Set(
        rows
          .map((row) => row.sourceInstanceId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const snapshotIds = Array.from(new Set(rows.map((row) => row.snapshotId)));

    const [sourceVolumeLookup, sourceInstanceLookup, snapshotCostLookup] = await Promise.all([
      sourceVolumeIds.length > 0
        ? this.loadSourceVolumeLookup({
            tenantId: input.tenantId,
            rows,
            sourceVolumeIds,
          })
        : {
            byConnectionRegionVolumeId: new Map<string, SourceVolumeRow>(),
            byConnectionVolumeId: new Map<string, SourceVolumeRow>(),
          },
      sourceInstanceIds.length > 0
        ? this.loadSourceInstanceLookup({
            tenantId: input.tenantId,
            rows,
            sourceInstanceIds,
          })
        : {
            byConnectionRegionInstanceId: new Map<string, SourceInstanceRow>(),
            byConnectionInstanceId: new Map<string, SourceInstanceRow>(),
          },
      this.loadSnapshotCostLookup({
        tenantId: input.tenantId,
        snapshotIds,
      }),
    ]);

    const nowMs = Date.now();

    const items: InventoryEc2SnapshotsListItem[] = rows.map((row) => {
      const sourceVolumeScopedKey = row.sourceVolumeId
        ? toScopedResourceKey(row.cloudConnectionId, row.regionKey, row.sourceVolumeId)
        : null;
      const sourceInstanceScopedKey = row.sourceInstanceId
        ? toScopedResourceKey(row.cloudConnectionId, row.regionKey, row.sourceInstanceId)
        : null;

      const sourceVolume = row.sourceVolumeId
        ? row.regionKey
          ? sourceVolumeLookup.byConnectionRegionVolumeId.get(sourceVolumeScopedKey ?? "")
          : sourceVolumeLookup.byConnectionVolumeId.get(
              toConnectionResourceKey(row.cloudConnectionId, row.sourceVolumeId),
            )
        : null;

      const sourceInstance = row.sourceInstanceId
        ? row.regionKey
          ? sourceInstanceLookup.byConnectionRegionInstanceId.get(sourceInstanceScopedKey ?? "")
          : sourceInstanceLookup.byConnectionInstanceId.get(
              toConnectionResourceKey(row.cloudConnectionId, row.sourceInstanceId),
            )
        : null;

      const normalizedSourceVolume = sourceVolume ?? null;
      const normalizedSourceInstance = sourceInstance ?? null;

      const ageDays = computeAgeDays(row.startTime, nowMs);
      const likelyOrphaned = row.sourceVolumeId === null || normalizedSourceVolume === null;
      const signal = computeSignal({ likelyOrphaned, ageDays });
      const cost = snapshotCostLookup.get(row.snapshotId) ?? {
        cost: null,
        currencyCode: null,
      };

      return {
        snapshotId: row.snapshotId,
        sourceVolumeId: row.sourceVolumeId,
        sourceVolumeName: normalizedSourceVolume?.sourceVolumeName ?? null,
        sourceInstanceId: row.sourceInstanceId,
        sourceInstanceName: normalizedSourceInstance?.sourceInstanceName ?? null,
        state: row.state,
        storageTier: row.storageTier,
        encrypted: row.encrypted,
        kmsKeyId: row.kmsKeyId,
        progress: row.progress,
        startTime: toIsoOrNull(row.startTime),
        ageDays,
        likelyOrphaned,
        signal,
        cost: cost.cost,
        currencyCode: cost.currencyCode,
        regionKey: row.regionKey,
        subAccountKey: row.subAccountKey,
        tags: row.tags,
        metadata: row.metadata,
      };
    });

    return {
      items,
      summary,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  private buildInventoryWhereClause(input: {
    tenantId: string;
    query: InventoryEc2SnapshotsListQuery;
  }): InventoryWhereClause {
    const whereParts: string[] = [
      "inv.tenant_id = $1",
      "inv.is_current = true",
      "inv.deleted_at IS NULL",
    ];
    const bind: unknown[] = [input.tenantId];
    let nextIndex = 2;

    if (input.query.cloudConnectionId) {
      whereParts.push(`inv.cloud_connection_id = $${nextIndex}`);
      bind.push(input.query.cloudConnectionId);
      nextIndex += 1;
    }

    if (input.query.regionKey) {
      whereParts.push(`inv.region_key::text = $${nextIndex}`);
      bind.push(input.query.regionKey);
      nextIndex += 1;
    }

    const normalizedState = normalizeLower(input.query.state);
    if (normalizedState) {
      whereParts.push(`LOWER(COALESCE(inv.state, '')) = $${nextIndex}`);
      bind.push(normalizedState);
      nextIndex += 1;
    }

    const normalizedStorageTier = normalizeLower(input.query.storageTier);
    if (normalizedStorageTier) {
      whereParts.push(`LOWER(COALESCE(inv.storage_tier, '')) = $${nextIndex}`);
      bind.push(normalizedStorageTier);
      nextIndex += 1;
    }

    if (input.query.encrypted !== null) {
      whereParts.push(`inv.encrypted = $${nextIndex}`);
      bind.push(input.query.encrypted);
      nextIndex += 1;
    }

    const normalizedSearch = normalizeLower(input.query.search);
    if (normalizedSearch) {
      whereParts.push(`
        (
          LOWER(inv.snapshot_id) LIKE $${nextIndex}
          OR LOWER(COALESCE(inv.source_volume_id, '')) LIKE $${nextIndex}
          OR LOWER(COALESCE(inv.tags_json ->> 'Name', '')) LIKE $${nextIndex}
        )
      `);
      bind.push(`%${normalizedSearch}%`);
      nextIndex += 1;
    }

    return {
      clause: `WHERE ${whereParts.join(" AND ")}`,
      bind,
      nextIndex,
    };
  }

  private async loadInventoryPage(input: {
    query: InventoryEc2SnapshotsListQuery;
    where: InventoryWhereClause;
  }): Promise<{ total: number; rows: InventoryRow[] }> {
    const offset = (input.query.page - 1) * input.query.pageSize;

    const countRows = await sequelize.query<InventoryCountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM ec2_snapshot_inventory_snapshots inv
        ${input.where.clause};
      `,
      {
        bind: input.where.bind,
        type: QueryTypes.SELECT,
      },
    );
    const total = Number(countRows[0]?.total ?? 0) || 0;

    const limitIndex = input.where.nextIndex;
    const offsetIndex = input.where.nextIndex + 1;
    const rows = await sequelize.query<InventoryRow>(
      `
        SELECT
          inv.snapshot_id AS "snapshotId",
          inv.source_volume_id AS "sourceVolumeId",
          inv.source_instance_id AS "sourceInstanceId",
          inv.state AS "state",
          inv.storage_tier AS "storageTier",
          inv.encrypted AS "encrypted",
          inv.kms_key_id AS "kmsKeyId",
          inv.progress AS "progress",
          inv.start_time AS "startTime",
          inv.region_key::text AS "regionKey",
          inv.sub_account_key::text AS "subAccountKey",
          inv.tags_json AS "tags",
          inv.metadata_json AS "metadata",
          inv.cloud_connection_id::text AS "cloudConnectionId"
        FROM ec2_snapshot_inventory_snapshots inv
        ${input.where.clause}
        ORDER BY inv.updated_at DESC NULLS LAST, inv.snapshot_id ASC
        LIMIT $${limitIndex} OFFSET $${offsetIndex};
      `,
      {
        bind: [...input.where.bind, input.query.pageSize, offset],
        type: QueryTypes.SELECT,
      },
    );

    return { total, rows };
  }

  private async loadSourceVolumeLookup(input: {
    tenantId: string;
    rows: InventoryRow[];
    sourceVolumeIds: string[];
  }): Promise<{
    byConnectionRegionVolumeId: Map<string, SourceVolumeRow>;
    byConnectionVolumeId: Map<string, SourceVolumeRow>;
  }> {
    const cloudConnectionIds = Array.from(
      new Set(
        input.rows
          .map((row) => row.cloudConnectionId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const rows = await sequelize.query<SourceVolumeRow>(
      `
        SELECT
          inv.cloud_connection_id::text AS "cloudConnectionId",
          inv.region_key::text AS "regionKey",
          inv.volume_id AS "sourceVolumeId",
          COALESCE(NULLIF(TRIM(COALESCE(inv.tags_json ->> 'Name', '')), ''), inv.volume_id) AS "sourceVolumeName"
        FROM ec2_volume_inventory_snapshots inv
        WHERE inv.tenant_id = $1
          AND inv.is_current = true
          AND inv.deleted_at IS NULL
          AND inv.volume_id = ANY($2::text[])
          AND ($3::text[] IS NULL OR inv.cloud_connection_id::text = ANY($3::text[]));
      `,
      {
        bind: [
          input.tenantId,
          input.sourceVolumeIds,
          cloudConnectionIds.length > 0 ? cloudConnectionIds : null,
        ],
        type: QueryTypes.SELECT,
      },
    );

    const byConnectionRegionVolumeId = new Map<string, SourceVolumeRow>();
    const byConnectionVolumeId = new Map<string, SourceVolumeRow>();

    for (const row of rows) {
      byConnectionRegionVolumeId.set(
        toScopedResourceKey(row.cloudConnectionId, row.regionKey, row.sourceVolumeId),
        row,
      );
      byConnectionVolumeId.set(
        toConnectionResourceKey(row.cloudConnectionId, row.sourceVolumeId),
        row,
      );
    }

    return { byConnectionRegionVolumeId, byConnectionVolumeId };
  }

  private async loadSourceInstanceLookup(input: {
    tenantId: string;
    rows: InventoryRow[];
    sourceInstanceIds: string[];
  }): Promise<{
    byConnectionRegionInstanceId: Map<string, SourceInstanceRow>;
    byConnectionInstanceId: Map<string, SourceInstanceRow>;
  }> {
    const cloudConnectionIds = Array.from(
      new Set(
        input.rows
          .map((row) => row.cloudConnectionId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const rows = await sequelize.query<SourceInstanceRow>(
      `
        SELECT
          inv.cloud_connection_id::text AS "cloudConnectionId",
          inv.region_key::text AS "regionKey",
          inv.instance_id AS "sourceInstanceId",
          COALESCE(NULLIF(TRIM(COALESCE(inv.tags_json ->> 'Name', '')), ''), inv.instance_id) AS "sourceInstanceName"
        FROM ec2_instance_inventory_snapshots inv
        WHERE inv.tenant_id = $1
          AND inv.is_current = true
          AND inv.deleted_at IS NULL
          AND inv.instance_id = ANY($2::text[])
          AND ($3::text[] IS NULL OR inv.cloud_connection_id::text = ANY($3::text[]));
      `,
      {
        bind: [
          input.tenantId,
          input.sourceInstanceIds,
          cloudConnectionIds.length > 0 ? cloudConnectionIds : null,
        ],
        type: QueryTypes.SELECT,
      },
    );

    const byConnectionRegionInstanceId = new Map<string, SourceInstanceRow>();
    const byConnectionInstanceId = new Map<string, SourceInstanceRow>();

    for (const row of rows) {
      byConnectionRegionInstanceId.set(
        toScopedResourceKey(row.cloudConnectionId, row.regionKey, row.sourceInstanceId),
        row,
      );
      byConnectionInstanceId.set(
        toConnectionResourceKey(row.cloudConnectionId, row.sourceInstanceId),
        row,
      );
    }

    return { byConnectionRegionInstanceId, byConnectionInstanceId };
  }

  private async loadSnapshotCostLookup(input: {
    tenantId: string;
    snapshotIds: string[];
  }): Promise<Map<string, SnapshotCost>> {
    if (input.snapshotIds.length === 0) {
      return new Map();
    }

    const rows = await sequelize.query<SnapshotCostRow>(
      `
        WITH scoped AS (
          SELECT
            dr.resource_id AS snapshot_id,
            COALESCE(fcli.billing_account_key::text, '') AS billing_account_key,
            dd.full_date AS usage_date,
            SUM(COALESCE(fcli.billed_cost, fcli.effective_cost, fcli.list_cost, 0))::numeric AS daily_cost
          FROM fact_cost_line_items fcli
          INNER JOIN dim_resource dr
            ON dr.id = fcli.resource_key
          INNER JOIN dim_date dd
            ON dd.id = fcli.usage_date_key
          WHERE fcli.tenant_id = $1
            AND dr.tenant_id = $1
            AND dr.resource_id = ANY($2::text[])
            AND LOWER(COALESCE(dr.resource_type, '')) = 'ec2_snapshot'
          GROUP BY dr.resource_id, fcli.billing_account_key, dd.full_date
        ),
        monthly AS (
          SELECT
            scoped.snapshot_id,
            scoped.billing_account_key,
            COALESCE(
              SUM(
                CASE
                  WHEN scoped.usage_date >= DATE_TRUNC('month', CURRENT_DATE)::date THEN scoped.daily_cost
                  ELSE 0
                END
              ),
              0
            )::double precision AS month_to_date_cost
          FROM scoped
          GROUP BY scoped.snapshot_id, scoped.billing_account_key
        ),
        currency AS (
          SELECT
            monthly.snapshot_id,
            COALESCE(SUM(monthly.month_to_date_cost), 0)::double precision AS total_cost,
            ARRAY_REMOVE(
              ARRAY_AGG(DISTINCT NULLIF(TRIM(dba.billing_currency), '')),
              NULL
            ) AS currencies
          FROM monthly
          LEFT JOIN dim_billing_account dba
            ON dba.id::text = monthly.billing_account_key
            AND dba.tenant_id = $1
          GROUP BY monthly.snapshot_id
        )
        SELECT
          currency.snapshot_id AS "snapshotId",
          CASE
            WHEN COALESCE(array_length(currency.currencies, 1), 0) = 1 THEN currency.total_cost
            ELSE NULL
          END AS "cost",
          CASE
            WHEN COALESCE(array_length(currency.currencies, 1), 0) = 1 THEN currency.currencies[1]
            ELSE NULL
          END AS "currencyCode"
        FROM currency;
      `,
      {
        bind: [input.tenantId, input.snapshotIds],
        type: QueryTypes.SELECT,
      },
    );

    const lookup = new Map<string, SnapshotCost>();
    for (const row of rows) {
      lookup.set(row.snapshotId, {
        cost: toNullableNumber(row.cost),
        currencyCode: row.currencyCode ? row.currencyCode.trim() || null : null,
      });
    }
    return lookup;
  }

  private async loadSummary(input: {
    where: InventoryWhereClause;
  }): Promise<InventoryEc2SnapshotsSummary> {
    const thresholdIndex = input.where.nextIndex;
    const rows = await sequelize.query<SnapshotSummaryRow>(
      `
        WITH filtered AS (
          SELECT
            inv.id::text AS row_id,
            inv.snapshot_id,
            inv.source_volume_id,
            inv.start_time,
            inv.cloud_connection_id::text AS cloud_connection_id,
            inv.region_key::text AS region_key
          FROM ec2_snapshot_inventory_snapshots inv
          ${input.where.clause}
        ),
        filtered_snapshot_ids AS (
          SELECT DISTINCT
            f.snapshot_id
          FROM filtered f
        ),
        volume_presence AS (
          SELECT
            f.row_id,
            EXISTS (
              SELECT 1
              FROM ec2_volume_inventory_snapshots v
              WHERE v.tenant_id = $1
                AND v.is_current = true
                AND v.deleted_at IS NULL
                AND v.volume_id = f.source_volume_id
                AND COALESCE(v.cloud_connection_id::text, '') = COALESCE(f.cloud_connection_id, '')
                AND (
                  f.region_key IS NULL
                  OR v.region_key::text = f.region_key
                )
            ) AS has_current_volume
          FROM filtered f
        ),
        cost_scoped AS (
          SELECT
            fsi.snapshot_id,
            COALESCE(fcli.billing_account_key::text, '') AS billing_account_key,
            dd.full_date AS usage_date,
            SUM(COALESCE(fcli.billed_cost, fcli.effective_cost, fcli.list_cost, 0))::numeric AS daily_cost
          FROM filtered_snapshot_ids fsi
          INNER JOIN dim_resource dr
            ON dr.tenant_id = $1
            AND dr.resource_id = fsi.snapshot_id
            AND LOWER(COALESCE(dr.resource_type, '')) = 'ec2_snapshot'
          INNER JOIN fact_cost_line_items fcli
            ON fcli.tenant_id = $1
            AND fcli.resource_key = dr.id
          INNER JOIN dim_date dd
            ON dd.id = fcli.usage_date_key
          GROUP BY fsi.snapshot_id, fcli.billing_account_key, dd.full_date
        ),
        cost_monthly AS (
          SELECT
            cs.snapshot_id,
            cs.billing_account_key,
            COALESCE(
              SUM(
                CASE
                  WHEN cs.usage_date >= DATE_TRUNC('month', CURRENT_DATE)::date THEN cs.daily_cost
                  ELSE 0
                END
              ),
              0
            )::double precision AS month_to_date_cost
          FROM cost_scoped cs
          GROUP BY cs.snapshot_id, cs.billing_account_key
        ),
        cost_currency AS (
          SELECT
            cm.snapshot_id,
            COALESCE(SUM(cm.month_to_date_cost), 0)::double precision AS total_cost,
            ARRAY_REMOVE(
              ARRAY_AGG(DISTINCT NULLIF(TRIM(dba.billing_currency), '')),
              NULL
            ) AS currencies
          FROM cost_monthly cm
          LEFT JOIN dim_billing_account dba
            ON dba.id::text = cm.billing_account_key
            AND dba.tenant_id = $1
          GROUP BY cm.snapshot_id
        )
        SELECT
          COUNT(*)::text AS "snapshotsInView",
          COALESCE(
            SUM(
              CASE
                WHEN f.source_volume_id IS NULL OR NOT COALESCE(vp.has_current_volume, false) THEN 1
                ELSE 0
              END
            ),
            0
          )::text AS "likelyOrphanedCount",
          COALESCE(
            SUM(
              CASE
                WHEN f.start_time IS NOT NULL
                  AND (NOW() - f.start_time) >= ($${thresholdIndex}::int * INTERVAL '1 day')
                THEN 1
                ELSE 0
              END
            ),
            0
          )::text AS "oldSnapshotsCount",
          CASE
            WHEN COUNT(cc.snapshot_id) = 0 THEN NULL
            WHEN EXISTS (
              SELECT 1
              FROM cost_currency cc_invalid
              WHERE COALESCE(array_length(cc_invalid.currencies, 1), 0) <> 1
            ) THEN NULL
            WHEN (
              SELECT COUNT(DISTINCT cc_currency.currencies[1])
              FROM cost_currency cc_currency
              WHERE COALESCE(array_length(cc_currency.currencies, 1), 0) = 1
            ) > 1 THEN NULL
            ELSE
              COALESCE(
                SUM(cc.total_cost),
                0
              )::double precision
          END AS "totalSnapshotCost"
        FROM filtered f
        LEFT JOIN volume_presence vp
          ON vp.row_id = f.row_id
        LEFT JOIN cost_currency cc
          ON cc.snapshot_id = f.snapshot_id;
      `,
      {
        bind: [...input.where.bind, OLD_SNAPSHOT_AGE_DAYS],
        type: QueryTypes.SELECT,
      },
    );

    const row = rows[0];
    return {
      snapshotsInView: toIntOrZero(row?.snapshotsInView),
      likelyOrphanedCount: toIntOrZero(row?.likelyOrphanedCount),
      oldSnapshotsCount: toIntOrZero(row?.oldSnapshotsCount),
      totalSnapshotCost: toNullableNumber(row?.totalSnapshotCost),
    };
  }
}
