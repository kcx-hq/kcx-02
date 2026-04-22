import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../../models/index.js";
import type {
  InventoryEc2VolumesListItem,
  InventoryEc2VolumesListQuery,
  InventoryEc2VolumesListResponse,
} from "./volumes-inventory.types.js";

type InventoryRow = {
  volumeId: string;
  volumeName: string;
  volumeType: string | null;
  sizeGb: number | null;
  iops: number | null;
  throughput: number | null;
  state: string | null;
  availabilityZone: string | null;
  isAttached: boolean | null;
  attachedInstanceId: string | null;
  cloudConnectionId: string | null;
  regionKey: string | null;
  regionId: string | null;
  regionName: string | null;
  resourceKey: string | null;
  subAccountKey: string | null;
  discoveredAt: Date | string | null;
  tags: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

type InventoryCountRow = {
  total: string;
};

type InventoryWhereClause = {
  clause: string;
  bind: unknown[];
  nextIndex: number;
};

type AttachedInstanceRow = {
  cloudConnectionId: string | null;
  attachedInstanceId: string;
  attachedInstanceName: string;
  attachedInstanceState: string | null;
  attachedInstanceType: string | null;
};

const normalizeLower = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

const toConnectionInstanceKey = (
  cloudConnectionId: string | null,
  instanceId: string,
): string => `${cloudConnectionId ?? ""}::${instanceId}`;

const toIsoOrNull = (value: Date | string | null): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export class VolumesInventoryService {
  async listVolumes(input: {
    tenantId: string;
    query: InventoryEc2VolumesListQuery;
  }): Promise<InventoryEc2VolumesListResponse> {
    const page = input.query.page;
    const pageSize = input.query.pageSize;

    const { total, rows } = await this.loadInventoryPage({
      tenantId: input.tenantId,
      query: input.query,
    });

    const attachedInstanceIds = Array.from(
      new Set(
        rows
          .map((row) => row.attachedInstanceId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const attachedInstanceLookup =
      attachedInstanceIds.length > 0
        ? await this.loadAttachedInstances({
            tenantId: input.tenantId,
            rows,
            attachedInstanceIds,
          })
        : {
            byConnectionInstance: new Map<string, AttachedInstanceRow>(),
            byInstanceId: new Map<string, AttachedInstanceRow>(),
          };

    const items: InventoryEc2VolumesListItem[] = rows.map((row) => {
      const attachedInstance = row.attachedInstanceId
        ? attachedInstanceLookup.byConnectionInstance.get(
            toConnectionInstanceKey(row.cloudConnectionId, row.attachedInstanceId),
          ) ?? attachedInstanceLookup.byInstanceId.get(row.attachedInstanceId)
        : null;

      return {
        volumeId: row.volumeId,
        volumeName: row.volumeName,
        volumeType: row.volumeType,
        sizeGb: row.sizeGb,
        iops: row.iops,
        throughput: row.throughput,
        state: row.state,
        availabilityZone: row.availabilityZone,
        isAttached: row.isAttached,
        attachedInstanceId: row.attachedInstanceId,
        attachedInstanceName: attachedInstance?.attachedInstanceName ?? null,
        attachedInstanceState: attachedInstance?.attachedInstanceState ?? null,
        attachedInstanceType: attachedInstance?.attachedInstanceType ?? null,
        cloudConnectionId: row.cloudConnectionId,
        regionKey: row.regionKey,
        regionId: row.regionId,
        regionName: row.regionName,
        resourceKey: row.resourceKey,
        subAccountKey: row.subAccountKey,
        discoveredAt: toIsoOrNull(row.discoveredAt),
        tags: row.tags,
        metadata: row.metadata,
      };
    });

    return {
      items,
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
    query: InventoryEc2VolumesListQuery;
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

    const normalizedState = normalizeLower(input.query.state);
    if (normalizedState) {
      whereParts.push(`LOWER(COALESCE(inv.state, '')) = $${nextIndex}`);
      bind.push(normalizedState);
      nextIndex += 1;
    }

    const normalizedVolumeType = normalizeLower(input.query.volumeType);
    if (normalizedVolumeType) {
      whereParts.push(`LOWER(COALESCE(inv.volume_type, '')) = $${nextIndex}`);
      bind.push(normalizedVolumeType);
      nextIndex += 1;
    }

    if (input.query.isAttached !== null) {
      whereParts.push(`inv.is_attached = $${nextIndex}`);
      bind.push(input.query.isAttached);
      nextIndex += 1;
    }

    const normalizedRegion = normalizeLower(input.query.region);
    if (normalizedRegion) {
      const regionExactIdx = nextIndex;
      const regionLikeIdx = nextIndex + 1;
      whereParts.push(`
        (
          LOWER(COALESCE(dr.region_id, '')) = $${regionExactIdx}
          OR LOWER(COALESCE(dr.region_name, '')) = $${regionExactIdx}
          OR LOWER(COALESCE(inv.availability_zone, '')) = $${regionExactIdx}
          OR LOWER(COALESCE(inv.availability_zone, '')) LIKE $${regionLikeIdx}
        )
      `);
      bind.push(normalizedRegion);
      bind.push(`${normalizedRegion}%`);
      nextIndex += 2;
    }

    const normalizedSearch = normalizeLower(input.query.search);
    if (normalizedSearch) {
      whereParts.push(`
        (
          LOWER(inv.volume_id) LIKE $${nextIndex}
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
    tenantId: string;
    query: InventoryEc2VolumesListQuery;
  }): Promise<{ total: number; rows: InventoryRow[] }> {
    const where = this.buildInventoryWhereClause(input);
    const offset = (input.query.page - 1) * input.query.pageSize;

    const countRows = await sequelize.query<InventoryCountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM ec2_volume_inventory_snapshots inv
        LEFT JOIN dim_region dr
          ON dr.id = inv.region_key
        ${where.clause};
      `,
      {
        bind: where.bind,
        type: QueryTypes.SELECT,
      },
    );
    const total = Number(countRows[0]?.total ?? 0) || 0;

    const limitIndex = where.nextIndex;
    const offsetIndex = where.nextIndex + 1;
    const rows = await sequelize.query<InventoryRow>(
      `
        SELECT
          inv.volume_id AS "volumeId",
          COALESCE(NULLIF(TRIM(COALESCE(inv.tags_json ->> 'Name', '')), ''), inv.volume_id) AS "volumeName",
          inv.volume_type AS "volumeType",
          inv.size_gb AS "sizeGb",
          inv.iops AS "iops",
          inv.throughput AS "throughput",
          inv.state AS "state",
          inv.availability_zone AS "availabilityZone",
          inv.is_attached AS "isAttached",
          inv.attached_instance_id AS "attachedInstanceId",
          inv.cloud_connection_id::text AS "cloudConnectionId",
          inv.region_key::text AS "regionKey",
          dr.region_id AS "regionId",
          dr.region_name AS "regionName",
          inv.resource_key::text AS "resourceKey",
          inv.sub_account_key::text AS "subAccountKey",
          inv.discovered_at AS "discoveredAt",
          inv.tags_json AS "tags",
          inv.metadata_json AS "metadata"
        FROM ec2_volume_inventory_snapshots inv
        LEFT JOIN dim_region dr
          ON dr.id = inv.region_key
        ${where.clause}
        ORDER BY inv.updated_at DESC NULLS LAST, inv.volume_id ASC
        LIMIT $${limitIndex} OFFSET $${offsetIndex};
      `,
      {
        bind: [...where.bind, input.query.pageSize, offset],
        type: QueryTypes.SELECT,
      },
    );

    return { total, rows };
  }

  private async loadAttachedInstances(input: {
    tenantId: string;
    rows: InventoryRow[];
    attachedInstanceIds: string[];
  }): Promise<{
    byConnectionInstance: Map<string, AttachedInstanceRow>;
    byInstanceId: Map<string, AttachedInstanceRow>;
  }> {
    const cloudConnectionIds = Array.from(
      new Set(
        input.rows
          .map((row) => row.cloudConnectionId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const rows = await sequelize.query<AttachedInstanceRow>(
      `
        SELECT
          inv.cloud_connection_id::text AS "cloudConnectionId",
          inv.instance_id AS "attachedInstanceId",
          COALESCE(NULLIF(TRIM(COALESCE(inv.tags_json ->> 'Name', '')), ''), inv.instance_id) AS "attachedInstanceName",
          inv.state AS "attachedInstanceState",
          inv.instance_type AS "attachedInstanceType"
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
          input.attachedInstanceIds,
          cloudConnectionIds.length > 0 ? cloudConnectionIds : null,
        ],
        type: QueryTypes.SELECT,
      },
    );

    const byConnectionInstance = new Map<string, AttachedInstanceRow>();
    const byInstanceId = new Map<string, AttachedInstanceRow>();

    for (const row of rows) {
      byConnectionInstance.set(
        toConnectionInstanceKey(row.cloudConnectionId, row.attachedInstanceId),
        row,
      );
      if (!byInstanceId.has(row.attachedInstanceId)) {
        byInstanceId.set(row.attachedInstanceId, row);
      }
    }

    return { byConnectionInstance, byInstanceId };
  }
}
