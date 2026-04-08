import { QueryTypes } from "sequelize";

import { NotFoundError } from "../../../errors/http-errors.js";
import { sequelize } from "../../../models/index.js";
import {
  mapAdminCloudConnectionListRow,
  mapAutomaticConnectionDetail,
  mapManualConnectionDetail,
  normalizeMode,
  normalizeStatus,
  toIsoOrNull,
  toIsoOrThrow,
} from "./admin-cloud-connections.mapper.js";
import type {
  AdminCloudConnectionDetailResponse,
  AdminCloudConnectionListResponse,
  AdminCloudConnectionsListQueryParsed,
} from "./admin-cloud-connections.types.js";

type ListSummaryRow = {
  total: string | number;
  draft: string | number;
  connecting: string | number;
  awaiting_validation: string | number;
  active: string | number;
  active_with_warnings: string | number;
  failed: string | number;
  suspended: string | number;
  billing_source_missing: string | number;
};

type ListRow = {
  id: string;
  display_name: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  provider_id: number;
  provider_code: string;
  provider_name: string;
  connection_mode: string;
  status: string;
  status_message: string | null;
  error_message: string | null;
  cloud_account_id: string | null;
  payer_account_id: string | null;
  detail_record_type: string;
  detail_record_id: string;
  linked_billing_source_id: number | null;
  linked_billing_source_type: string | null;
  linked_billing_setup_mode: string | null;
  linked_billing_status: string | null;
  linked_last_file_received_at: string | null;
  linked_last_ingested_at: string | null;
  latest_run_id: number | null;
  latest_run_status: string | null;
  connected_at: string | null;
  last_validated_at: string | null;
  last_success_at: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

type IntegrationRow = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  provider_id: number;
  provider_code: string;
  provider_name: string;
  display_name: string;
  connection_mode: string;
  status: string;
  status_message: string | null;
  error_message: string | null;
  cloud_account_id: string | null;
  payer_account_id: string | null;
  detail_record_type: string;
  detail_record_id: string;
  connected_at: string | null;
  last_validated_at: string | null;
  last_success_at: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

type AutomaticDetailRow = {
  id: string;
  connection_name: string;
  account_type: string;
  region: string | null;
  external_id: string | null;
  callback_token: string | null;
  stack_name: string | null;
  stack_id: string | null;
  role_arn: string | null;
  cloud_account_id: string | null;
  payer_account_id: string | null;
  export_name: string | null;
  export_bucket: string | null;
  export_prefix: string | null;
  export_region: string | null;
  export_arn: string | null;
  connected_at: string | null;
  last_validated_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type ManualDetailRow = {
  id: string;
  connection_name: string;
  aws_account_id: string;
  role_arn: string;
  external_id: string;
  bucket_name: string;
  prefix: string | null;
  report_name: string | null;
  validation_status: string;
  assume_role_success: boolean;
  status: string;
  last_validated_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type BillingSourceRow = {
  id: number;
  source_name: string;
  source_type: string;
  setup_mode: string;
  format: string;
  schema_type: string;
  bucket_name: string | null;
  path_prefix: string | null;
  file_pattern: string | null;
  cadence: string | null;
  status: string;
  is_temporary: boolean;
  last_validated_at: string | null;
  last_file_received_at: string | null;
  last_ingested_at: string | null;
  created_at: string;
  updated_at: string;
};

type LatestRunRow = {
  id: number;
  status: string;
  current_step: string | null;
  progress_percent: number;
  status_message: string | null;
  rows_read: number;
  rows_loaded: number;
  rows_failed: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  raw_billing_file_id: number;
};

type LatestRawFileRow = {
  id: number;
  original_file_name: string;
  file_format: string;
  status: string;
  raw_storage_bucket: string;
  raw_storage_key: string;
  created_at: string;
};

const SORT_FIELD_MAP: Record<AdminCloudConnectionsListQueryParsed["sortBy"], string> = {
  displayName: "ci.display_name",
  status: "ci.status",
  mode: "ci.connection_mode",
  cloudAccountId: "ci.cloud_account_id",
  lastValidatedAt: "ci.last_validated_at",
  connectedAt: "ci.connected_at",
  createdAt: "ci.created_at",
  updatedAt: "ci.updated_at",
};

const buildListWhere = (query: AdminCloudConnectionsListQueryParsed) => {
  const clauses: string[] = [];
  const replacements: Record<string, unknown> = {};

  if (query.search) {
    clauses.push(`(
      ci.display_name ILIKE :searchPattern
      OR COALESCE(ci.cloud_account_id, '') ILIKE :searchPattern
      OR COALESCE(ci.payer_account_id, '') ILIKE :searchPattern
      OR COALESCE(t.name, '') ILIKE :searchPattern
      OR COALESCE(t.slug, '') ILIKE :searchPattern
    )`);
    replacements.searchPattern = `%${query.search}%`;
  }

  if (query.provider) {
    clauses.push("(LOWER(cp.code) = LOWER(:providerValue) OR CAST(cp.id AS TEXT) = :providerValue)");
    replacements.providerValue = query.provider;
  }

  if (query.mode) {
    clauses.push("ci.connection_mode = :mode");
    replacements.mode = query.mode;
  }

  if (query.status) {
    clauses.push("ci.status = :status");
    replacements.status = query.status;
  }

  if (query.billingSourceLinked !== null) {
    clauses.push(query.billingSourceLinked ? "bs_link.id IS NOT NULL" : "bs_link.id IS NULL");
  }

  if (query.dateFrom) {
    clauses.push("ci.created_at >= :dateFrom");
    replacements.dateFrom = query.dateFrom.toISOString();
  }

  if (query.dateTo) {
    clauses.push("ci.created_at <= :dateTo");
    replacements.dateTo = query.dateTo.toISOString();
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    replacements,
  };
};

const listFromSql = `
FROM cloud_integrations ci
JOIN tenants t ON t.id = ci.tenant_id
JOIN cloud_providers cp ON cp.id = ci.provider_id
LEFT JOIN manual_cloud_connections mc
  ON ci.connection_mode = 'manual'
 AND ci.detail_record_type = 'manual_cloud_connection'
 AND mc.id = ci.detail_record_id
 AND mc.tenant_id = ci.tenant_id
LEFT JOIN LATERAL (
  SELECT bs.*
  FROM billing_sources bs
  WHERE bs.tenant_id = CAST(ci.tenant_id AS TEXT)
    AND bs.cloud_provider_id = ci.provider_id
    AND (
      (
        ci.connection_mode = 'automatic'
        AND ci.detail_record_type = 'automatic_cloud_connection'
        AND CAST(bs.cloud_connection_id AS TEXT) = CAST(ci.detail_record_id AS TEXT)
      )
      OR (
        ci.connection_mode = 'manual'
        AND ci.detail_record_type = 'manual_cloud_connection'
        AND mc.id IS NOT NULL
        AND COALESCE(bs.bucket_name, '') = COALESCE(mc.bucket_name, '')
        AND COALESCE(bs.path_prefix, '') = COALESCE(mc.prefix, '')
        AND COALESCE(bs.is_temporary, false) = false
      )
    )
  ORDER BY bs.updated_at DESC, bs.id DESC
  LIMIT 1
) bs_link ON true
LEFT JOIN LATERAL (
  SELECT bir.id, bir.status
  FROM billing_ingestion_runs bir
  WHERE bs_link.id IS NOT NULL
    AND bir.billing_source_id = bs_link.id
  ORDER BY bir.created_at DESC, bir.id DESC
  LIMIT 1
) latest_run ON true
`;

const resolveSummary = async (
  query: AdminCloudConnectionsListQueryParsed,
): Promise<{
  total: number;
  draft: number;
  connecting: number;
  awaitingValidation: number;
  active: number;
  activeWithWarnings: number;
  failed: number;
  suspended: number;
  billingSourceMissing: number;
}> => {
  const { whereSql, replacements } = buildListWhere(query);

  const [summary] = await sequelize.query<ListSummaryRow>(
    `
    WITH filtered AS (
      SELECT
        ci.status,
        bs_link.id AS linked_billing_source_id
      ${listFromSql}
      ${whereSql}
    )
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE status = 'draft')::bigint AS draft,
      COUNT(*) FILTER (WHERE status = 'connecting')::bigint AS connecting,
      COUNT(*) FILTER (WHERE status = 'awaiting_validation')::bigint AS awaiting_validation,
      COUNT(*) FILTER (WHERE status = 'active')::bigint AS active,
      COUNT(*) FILTER (WHERE status = 'active_with_warnings')::bigint AS active_with_warnings,
      COUNT(*) FILTER (WHERE status = 'failed')::bigint AS failed,
      COUNT(*) FILTER (WHERE status = 'suspended')::bigint AS suspended,
      COUNT(*) FILTER (WHERE linked_billing_source_id IS NULL)::bigint AS billing_source_missing
    FROM filtered
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );

  return {
    total: Number(summary?.total ?? 0),
    draft: Number(summary?.draft ?? 0),
    connecting: Number(summary?.connecting ?? 0),
    awaitingValidation: Number(summary?.awaiting_validation ?? 0),
    active: Number(summary?.active ?? 0),
    activeWithWarnings: Number(summary?.active_with_warnings ?? 0),
    failed: Number(summary?.failed ?? 0),
    suspended: Number(summary?.suspended ?? 0),
    billingSourceMissing: Number(summary?.billing_source_missing ?? 0),
  };
};

export async function listCloudConnections(
  query: AdminCloudConnectionsListQueryParsed,
): Promise<AdminCloudConnectionListResponse> {
  const offset = (query.page - 1) * query.limit;
  const sortColumn = SORT_FIELD_MAP[query.sortBy];
  const sortDirection = query.sortOrder.toUpperCase();
  const { whereSql, replacements } = buildListWhere(query);

  const summary = await resolveSummary(query);

  const rows = await sequelize.query<ListRow>(
    `
    SELECT
      ci.id,
      ci.display_name,
      ci.tenant_id,
      t.name AS tenant_name,
      t.slug AS tenant_slug,
      cp.id AS provider_id,
      cp.code AS provider_code,
      cp.name AS provider_name,
      ci.connection_mode,
      ci.status,
      ci.status_message,
      ci.error_message,
      ci.cloud_account_id,
      ci.payer_account_id,
      ci.detail_record_type,
      ci.detail_record_id,
      bs_link.id AS linked_billing_source_id,
      bs_link.source_type AS linked_billing_source_type,
      bs_link.setup_mode AS linked_billing_setup_mode,
      bs_link.status AS linked_billing_status,
      bs_link.last_file_received_at AS linked_last_file_received_at,
      bs_link.last_ingested_at AS linked_last_ingested_at,
      latest_run.id AS latest_run_id,
      latest_run.status AS latest_run_status,
      ci.connected_at,
      ci.last_validated_at,
      ci.last_success_at,
      ci.last_checked_at,
      ci.created_at,
      ci.updated_at
    ${listFromSql}
    ${whereSql}
    ORDER BY ${sortColumn} ${sortDirection}, ci.id DESC
    LIMIT :limit OFFSET :offset
    `,
    {
      replacements: {
        ...replacements,
        limit: query.limit,
        offset,
      },
      type: QueryTypes.SELECT,
    },
  );

  const total = summary.total;
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

  return {
    data: rows.map((row) => mapAdminCloudConnectionListRow(row)),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
    },
    summary,
  };
}

const getCloudConnectionIntegrationById = async (integrationId: string): Promise<IntegrationRow> => {
  const [row] = await sequelize.query<IntegrationRow>(
    `
    SELECT
      ci.id,
      ci.tenant_id,
      t.name AS tenant_name,
      t.slug AS tenant_slug,
      cp.id AS provider_id,
      cp.code AS provider_code,
      cp.name AS provider_name,
      ci.display_name,
      ci.connection_mode,
      ci.status,
      ci.status_message,
      ci.error_message,
      ci.cloud_account_id,
      ci.payer_account_id,
      ci.detail_record_type,
      ci.detail_record_id,
      ci.connected_at,
      ci.last_validated_at,
      ci.last_success_at,
      ci.last_checked_at,
      ci.created_at,
      ci.updated_at
    FROM cloud_integrations ci
    JOIN tenants t ON t.id = ci.tenant_id
    JOIN cloud_providers cp ON cp.id = ci.provider_id
    WHERE ci.id = :integrationId
    LIMIT 1
    `,
    {
      replacements: { integrationId },
      type: QueryTypes.SELECT,
    },
  );

  if (!row) {
    throw new NotFoundError("Cloud integration not found");
  }

  return row;
};

const resolveConnectionDetail = async (integration: IntegrationRow) => {
  if (
    integration.detail_record_type === "automatic_cloud_connection" &&
    integration.connection_mode === "automatic"
  ) {
    const [detail] = await sequelize.query<AutomaticDetailRow>(
      `
      SELECT
        id,
        connection_name,
        account_type,
        region,
        external_id,
        callback_token,
        stack_name,
        stack_id,
        role_arn,
        cloud_account_id,
        payer_account_id,
        export_name,
        export_bucket,
        export_prefix,
        export_region,
        export_arn,
        connected_at,
        last_validated_at,
        error_message,
        created_at,
        updated_at
      FROM cloud_connections
      WHERE id = :detailRecordId
        AND tenant_id = :tenantId
      LIMIT 1
      `,
      {
        replacements: {
          detailRecordId: integration.detail_record_id,
          tenantId: integration.tenant_id,
        },
        type: QueryTypes.SELECT,
      },
    );

    return {
      detailRecordMissing: !detail,
      connectionDetail: detail ? mapAutomaticConnectionDetail(detail) : null,
      manualDetailRow: null as ManualDetailRow | null,
    };
  }

  if (
    integration.detail_record_type === "manual_cloud_connection" &&
    integration.connection_mode === "manual"
  ) {
    const [detail] = await sequelize.query<ManualDetailRow>(
      `
      SELECT
        id,
        connection_name,
        aws_account_id,
        role_arn,
        external_id,
        bucket_name,
        prefix,
        report_name,
        validation_status,
        assume_role_success,
        status,
        last_validated_at,
        error_message,
        created_at,
        updated_at
      FROM manual_cloud_connections
      WHERE id = :detailRecordId
        AND tenant_id = :tenantId
      LIMIT 1
      `,
      {
        replacements: {
          detailRecordId: integration.detail_record_id,
          tenantId: integration.tenant_id,
        },
        type: QueryTypes.SELECT,
      },
    );

    return {
      detailRecordMissing: !detail,
      connectionDetail: detail ? mapManualConnectionDetail(detail) : null,
      manualDetailRow: detail ?? null,
    };
  }

  return {
    detailRecordMissing: true,
    connectionDetail: null,
    manualDetailRow: null as ManualDetailRow | null,
  };
};

const resolveBillingSource = async (input: {
  integration: IntegrationRow;
  manualDetailRow: ManualDetailRow | null;
}): Promise<BillingSourceRow | null> => {
  const { integration, manualDetailRow } = input;

  if (
    integration.connection_mode === "automatic" &&
    integration.detail_record_type === "automatic_cloud_connection"
  ) {
    const [source] = await sequelize.query<BillingSourceRow>(
      `
      SELECT
        id,
        source_name,
        source_type,
        setup_mode,
        format,
        schema_type,
        bucket_name,
        path_prefix,
        file_pattern,
        cadence,
        status,
        is_temporary,
        last_validated_at,
        last_file_received_at,
        last_ingested_at,
        created_at,
        updated_at
      FROM billing_sources
      WHERE tenant_id = CAST(:tenantId AS TEXT)
        AND cloud_provider_id = :providerId
        AND CAST(cloud_connection_id AS TEXT) = :detailRecordId
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
      `,
      {
        replacements: {
          tenantId: integration.tenant_id,
          providerId: integration.provider_id,
          detailRecordId: integration.detail_record_id,
        },
        type: QueryTypes.SELECT,
      },
    );
    return source ?? null;
  }

  if (
    integration.connection_mode === "manual" &&
    integration.detail_record_type === "manual_cloud_connection" &&
    manualDetailRow
  ) {
    const [source] = await sequelize.query<BillingSourceRow>(
      `
      SELECT
        id,
        source_name,
        source_type,
        setup_mode,
        format,
        schema_type,
        bucket_name,
        path_prefix,
        file_pattern,
        cadence,
        status,
        is_temporary,
        last_validated_at,
        last_file_received_at,
        last_ingested_at,
        created_at,
        updated_at
      FROM billing_sources
      WHERE tenant_id = CAST(:tenantId AS TEXT)
        AND cloud_provider_id = :providerId
        AND COALESCE(bucket_name, '') = COALESCE(:bucketName, '')
        AND COALESCE(path_prefix, '') = COALESCE(:pathPrefix, '')
        AND COALESCE(is_temporary, false) = false
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
      `,
      {
        replacements: {
          tenantId: integration.tenant_id,
          providerId: integration.provider_id,
          bucketName: manualDetailRow.bucket_name,
          pathPrefix: manualDetailRow.prefix,
        },
        type: QueryTypes.SELECT,
      },
    );
    return source ?? null;
  }

  return null;
};

const resolveLatestIngestion = async (
  billingSourceId: number | null,
): Promise<{
  latestRun: {
    id: number;
    status: string;
    currentStep: string | null;
    progressPercent: number;
    statusMessage: string | null;
    rowsRead: number;
    rowsLoaded: number;
    rowsFailed: number;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  latestRawFile: {
    id: number;
    originalFileName: string;
    fileFormat: string;
    status: string;
    rawStorageBucket: string;
    rawStorageKey: string;
    createdAt: string;
  } | null;
}> => {
  if (billingSourceId === null) {
    return {
      latestRun: null,
      latestRawFile: null,
    };
  }

  const [latestRun] = await sequelize.query<LatestRunRow>(
    `
    SELECT
      id,
      status,
      current_step,
      progress_percent,
      status_message,
      rows_read,
      rows_loaded,
      rows_failed,
      started_at,
      finished_at,
      created_at,
      updated_at,
      raw_billing_file_id
    FROM billing_ingestion_runs
    WHERE billing_source_id = :billingSourceId
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    `,
    {
      replacements: { billingSourceId },
      type: QueryTypes.SELECT,
    },
  );

  if (!latestRun) {
    return {
      latestRun: null,
      latestRawFile: null,
    };
  }

  const [latestRawFile] = await sequelize.query<LatestRawFileRow>(
    `
    SELECT
      id,
      original_file_name,
      file_format,
      status,
      raw_storage_bucket,
      raw_storage_key,
      created_at
    FROM raw_billing_files
    WHERE id = :rawBillingFileId
    LIMIT 1
    `,
    {
      replacements: { rawBillingFileId: latestRun.raw_billing_file_id },
      type: QueryTypes.SELECT,
    },
  );

  return {
    latestRun: {
      id: Number(latestRun.id),
      status: latestRun.status,
      currentStep: latestRun.current_step,
      progressPercent: Number(latestRun.progress_percent ?? 0),
      statusMessage: latestRun.status_message,
      rowsRead: Number(latestRun.rows_read ?? 0),
      rowsLoaded: Number(latestRun.rows_loaded ?? 0),
      rowsFailed: Number(latestRun.rows_failed ?? 0),
      startedAt: toIsoOrNull(latestRun.started_at),
      finishedAt: toIsoOrNull(latestRun.finished_at),
      createdAt: toIsoOrThrow(latestRun.created_at),
      updatedAt: toIsoOrThrow(latestRun.updated_at),
    },
    latestRawFile: latestRawFile
      ? {
          id: Number(latestRawFile.id),
          originalFileName: latestRawFile.original_file_name,
          fileFormat: latestRawFile.file_format,
          status: latestRawFile.status,
          rawStorageBucket: latestRawFile.raw_storage_bucket,
          rawStorageKey: latestRawFile.raw_storage_key,
          createdAt: toIsoOrThrow(latestRawFile.created_at),
        }
      : null,
  };
};

export async function getCloudConnectionDetail(
  integrationId: string,
): Promise<AdminCloudConnectionDetailResponse> {
  const integration = await getCloudConnectionIntegrationById(integrationId);
  const resolvedDetail = await resolveConnectionDetail(integration);
  const billingSource = await resolveBillingSource({
    integration,
    manualDetailRow: resolvedDetail.manualDetailRow,
  });
  const latestIngestion = await resolveLatestIngestion(billingSource ? Number(billingSource.id) : null);

  return {
    data: {
      integration: {
        id: integration.id,
        displayName: integration.display_name,
        mode: normalizeMode(integration.connection_mode),
        status: normalizeStatus(integration.status),
        statusMessage: integration.status_message,
        errorMessage: integration.error_message,
        cloudAccountId: integration.cloud_account_id,
        payerAccountId: integration.payer_account_id,
        detailRecordType: integration.detail_record_type,
        detailRecordId: integration.detail_record_id,
        detailRecordMissing: resolvedDetail.detailRecordMissing,
        timestamps: {
          connectedAt: toIsoOrNull(integration.connected_at),
          lastValidatedAt: toIsoOrNull(integration.last_validated_at),
          lastSuccessAt: toIsoOrNull(integration.last_success_at),
          lastCheckedAt: toIsoOrNull(integration.last_checked_at),
          createdAt: toIsoOrThrow(integration.created_at),
          updatedAt: toIsoOrThrow(integration.updated_at),
        },
      },
      tenant: {
        id: integration.tenant_id,
        name: integration.tenant_name,
        slug: integration.tenant_slug,
      },
      provider: {
        id: Number(integration.provider_id),
        code: integration.provider_code,
        name: integration.provider_name,
      },
      connectionDetail: resolvedDetail.connectionDetail,
      billingSource: {
        linked: Boolean(billingSource),
        id: billingSource ? Number(billingSource.id) : null,
        sourceName: billingSource?.source_name ?? null,
        sourceType: billingSource?.source_type ?? null,
        setupMode: billingSource?.setup_mode ?? null,
        format: billingSource?.format ?? null,
        schemaType: billingSource?.schema_type ?? null,
        bucketName: billingSource?.bucket_name ?? null,
        pathPrefix: billingSource?.path_prefix ?? null,
        filePattern: billingSource?.file_pattern ?? null,
        cadence: billingSource?.cadence ?? null,
        status: billingSource?.status ?? null,
        isTemporary: billingSource ? Boolean(billingSource.is_temporary) : null,
        lastValidatedAt: toIsoOrNull(billingSource?.last_validated_at),
        lastFileReceivedAt: toIsoOrNull(billingSource?.last_file_received_at),
        lastIngestedAt: toIsoOrNull(billingSource?.last_ingested_at),
        createdAt: toIsoOrNull(billingSource?.created_at),
        updatedAt: toIsoOrNull(billingSource?.updated_at),
      },
      latestIngestion: {
        hasData: Boolean(latestIngestion.latestRun),
        latestRun: latestIngestion.latestRun,
        latestRawFile: latestIngestion.latestRawFile,
      },
    },
  };
}
