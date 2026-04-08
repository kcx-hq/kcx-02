import { QueryTypes } from "sequelize";

import { BadRequestError, NotFoundError } from "../../../errors/http-errors.js";
import { sequelize } from "../../../models/index.js";
import type {
  AdminBillingUploadDetails,
  AdminBillingUploadNormalizedStatus,
  AdminBillingUploadsListQuery,
  AdminBillingUploadsListQueryParsed,
  AdminBillingUploadsListResult,
  AdminBillingUploadStatusLabel,
} from "./admin-billing-uploads.types.js";

type ListQueryRow = {
  run_id: number;
  tenant_id: string;
  tenant_name: string | null;
  uploaded_by_name: string | null;
  source_type: string;
  setup_mode: string;
  is_temporary: boolean;
  file_name: string;
  file_format: string;
  run_status: string;
  progress_percent: number;
  started_at: string | null;
  finished_at: string | null;
  rows_failed: number;
  row_error_count: number;
};

type TotalCountRow = {
  total: string | number;
};

type DetailQueryRow = {
  run_id: number;
  run_status: string;
  current_step: string | null;
  progress_percent: number;
  status_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  run_created_at: string;
  run_updated_at: string;
  last_heartbeat_at: string | null;
  rows_read: number;
  rows_loaded: number;
  rows_failed: number;
  total_rows_estimated: number | null;
  run_error_message: string | null;

  tenant_id: string;
  tenant_name: string;

  billing_source_id: number;
  source_name: string;
  source_type: string;
  setup_mode: string;
  is_temporary: boolean;
  source_status: string;
  cloud_connection_id: string | null;

  provider_id: number;
  provider_code: string;
  provider_name: string;

  raw_billing_file_id: number;
  original_file_name: string;
  original_file_path: string | null;
  file_format: string;
  file_size_bytes: string | number | null;
  checksum: string | null;
  file_created_at: string;
  file_status: string;
  raw_storage_bucket: string;
  raw_storage_key: string;

  uploaded_by_id: string | null;
  uploaded_by_name: string | null;
  uploaded_by_email: string | null;

  row_error_count: number;
};

type RowErrorSampleRow = {
  id: number;
  row_number: number | null;
  error_code: string | null;
  error_message: string;
  created_at: string;
};

type RelatedFileRow = {
  raw_billing_file_id: number;
  file_role: string;
  processing_order: number;
  original_file_name: string;
  file_format: string;
  status: string;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_STATUS_FILTERS = ["queued", "processing", "completed", "warning", "failed"] as const;
type AllowedStatusFilter = (typeof ALLOWED_STATUS_FILTERS)[number];

type ListSortBy = AdminBillingUploadsListQueryParsed["sortBy"];

const SORT_FIELD_MAP: Record<ListSortBy, string> = {
  created_at: "bir.created_at",
  started_at: "bir.started_at",
  finished_at: "bir.finished_at",
  status: "bir.status",
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value === "undefined" || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const parsePositiveInt = (value: unknown, fieldName: string, fallback: number): number => {
  if (typeof value === "undefined" || value === null || String(value).trim().length === 0) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`${fieldName} must be a positive integer`);
  }
  return parsed;
};

const parseSortBy = (value: unknown): ListSortBy => {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  if (!normalized) return "created_at";

  if (
    normalized !== "created_at" &&
    normalized !== "started_at" &&
    normalized !== "finished_at" &&
    normalized !== "status"
  ) {
    throw new BadRequestError("sortBy must be one of created_at, started_at, finished_at, status");
  }

  return normalized;
};

const parseSortOrder = (value: unknown): "asc" | "desc" => {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  if (!normalized) return "desc";
  if (normalized !== "asc" && normalized !== "desc") {
    throw new BadRequestError("sortOrder must be asc or desc");
  }
  return normalized;
};

const parseDate = (value: unknown, fieldName: string): Date | null => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid date`);
  }
  return date;
};

const parseStatusFilter = (value: unknown): AllowedStatusFilter | null => {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  if (!normalized) return null;

  if (
    normalized !== "queued" &&
    normalized !== "processing" &&
    normalized !== "completed" &&
    normalized !== "warning" &&
    normalized !== "failed"
  ) {
    throw new BadRequestError("status must be one of queued, processing, completed, warning, failed");
  }

  return normalized;
};

const parseDateTo = (value: unknown): Date | null => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  const date = parseDate(normalized, "dateTo");
  if (!date) return null;

  if (DATE_ONLY_REGEX.test(normalized)) {
    return new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  return date;
};

const parseListQuery = (query: AdminBillingUploadsListQuery): AdminBillingUploadsListQueryParsed => {
  const page = parsePositiveInt(query.page, "page", DEFAULT_PAGE);
  const parsedLimit = parsePositiveInt(query.limit, "limit", DEFAULT_LIMIT);
  const limit = Math.min(parsedLimit, MAX_LIMIT);

  const dateFrom = parseDate(query.dateFrom, "dateFrom");
  const dateTo = parseDateTo(query.dateTo);
  if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
    throw new BadRequestError("dateFrom must be less than or equal to dateTo");
  }

  return {
    page,
    limit,
    search: normalizeOptionalString(query.search),
    status: parseStatusFilter(query.status),
    sourceType: normalizeOptionalString(query.sourceType),
    clientId: normalizeOptionalString(query.clientId),
    dateFrom,
    dateTo,
    sortBy: parseSortBy(query.sortBy),
    sortOrder: parseSortOrder(query.sortOrder),
  };
};

export const normalizeStatus = (rawStatus: string): AdminBillingUploadNormalizedStatus => {
  const normalizedRaw = String(rawStatus ?? "").trim().toLowerCase();

  if (normalizedRaw === "queued") return "queued";

  if (
    normalizedRaw === "validating_schema" ||
    normalizedRaw === "reading_rows" ||
    normalizedRaw === "normalizing" ||
    normalizedRaw === "upserting_dimensions" ||
    normalizedRaw === "inserting_facts" ||
    normalizedRaw === "finalizing"
  ) {
    return "processing";
  }

  if (normalizedRaw === "completed") return "completed";
  if (normalizedRaw === "completed_with_warnings") return "warning";
  if (normalizedRaw === "failed") return "failed";

  return "processing";
};

export const getStatusLabel = (status: AdminBillingUploadNormalizedStatus): AdminBillingUploadStatusLabel => {
  if (status === "queued") return "Queued";
  if (status === "processing") return "Processing";
  if (status === "completed") return "Completed";
  if (status === "warning") return "Warning";
  return "Failed";
};

export const buildSourceLabel = (
  sourceType: string,
  setupMode: string,
  isTemporary: boolean,
): string => {
  const sourceTypeNormalized = String(sourceType ?? "").trim().toLowerCase();
  const setupModeNormalized = String(setupMode ?? "").trim().toLowerCase();

  if (
    sourceTypeNormalized === "aws_data_exports_manual"
    || (sourceTypeNormalized === "aws_data_exports_cur2" && setupModeNormalized === "manual")
  ) {
    return "Cloud-Manual";
  }
  if (setupModeNormalized === "cloud_connected" || sourceTypeNormalized === "aws_data_exports_cur2") {
    return "Cloud-Auto";
  }
  if (sourceTypeNormalized === "manual_upload" || sourceTypeNormalized === "manual" || sourceTypeNormalized === "local") {
    return "Local";
  }
  if (sourceTypeNormalized === "s3" || setupModeNormalized === "temporary" || isTemporary) return "S3 Bucket";

  const readable = sourceTypeNormalized.replace(/[_-]+/g, " ").trim();
  if (!readable) return "Unknown Source";
  return readable
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
};

const toIsoOrNull = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toIntOrNull = (value: string | number | null): number | null => {
  if (value === null || typeof value === "undefined") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const mapListRow = (row: ListQueryRow) => {
  const normalizedStatus = normalizeStatus(row.run_status);
  const companyName = typeof row.tenant_name === "string" && row.tenant_name.trim().length > 0 ? row.tenant_name.trim() : null;
  const userName =
    typeof row.uploaded_by_name === "string" && row.uploaded_by_name.trim().length > 0 ? row.uploaded_by_name.trim() : null;
  const fallbackClientName = userName ?? companyName ?? "Unknown";

  return {
    runId: Number(row.run_id),
    client: {
      id: String(row.tenant_id),
      name: fallbackClientName,
      userName,
      companyName,
    },
    source: {
      type: String(row.source_type),
      label: buildSourceLabel(String(row.source_type), String(row.setup_mode), Boolean(row.is_temporary)),
    },
    file: {
      name: String(row.file_name ?? "Unknown file"),
      format: String(row.file_format ?? "unknown"),
    },
    status: {
      raw: String(row.run_status),
      normalized: normalizedStatus,
      label: getStatusLabel(normalizedStatus),
    },
    progress: {
      percent: Number(row.progress_percent ?? 0),
    },
    startedAt: toIsoOrNull(row.started_at),
    finishedAt: toIsoOrNull(row.finished_at),
    hasErrors: Number(row.rows_failed ?? 0) > 0 || Number(row.row_error_count ?? 0) > 0,
  };
};

const resolveStatusFilterRawValues = (status: string | null): string[] | null => {
  if (!status) return null;

  if (status === "queued") return ["queued"];
  if (status === "processing") {
    return [
      "validating_schema",
      "reading_rows",
      "normalizing",
      "upserting_dimensions",
      "inserting_facts",
      "finalizing",
    ];
  }
  if (status === "completed") return ["completed"];
  if (status === "warning") return ["completed_with_warnings"];
  if (status === "failed") return ["failed"];

  return null;
};

const buildListWhere = (query: AdminBillingUploadsListQueryParsed) => {
  const clauses: string[] = [];
  const replacements: Record<string, unknown> = {};

  if (query.search) {
    clauses.push(`(
      COALESCE(rbf.original_file_name, '') ILIKE :searchPattern
      OR COALESCE(t.name, '') ILIKE :searchPattern
      OR COALESCE(bs.source_type, '') ILIKE :searchPattern
      OR COALESCE(bs.source_name, '') ILIKE :searchPattern
      OR COALESCE(bs.setup_mode, '') ILIKE :searchPattern
      OR COALESCE(bir.status, '') ILIKE :searchPattern
      OR (
        CASE
          WHEN LOWER(COALESCE(bs.source_type, '')) = 'aws_data_exports_manual'
            OR (LOWER(COALESCE(bs.source_type, '')) = 'aws_data_exports_cur2' AND LOWER(COALESCE(bs.setup_mode, '')) = 'manual')
            THEN 'cloud-manual'
          WHEN LOWER(COALESCE(bs.setup_mode, '')) = 'cloud_connected'
            OR LOWER(COALESCE(bs.source_type, '')) = 'aws_data_exports_cur2'
            THEN 'cloud-auto'
          WHEN LOWER(COALESCE(bs.source_type, '')) IN ('manual_upload', 'manual', 'local') THEN 'local'
          WHEN LOWER(COALESCE(bs.source_type, '')) = 's3'
            OR LOWER(COALESCE(bs.setup_mode, '')) = 'temporary'
            OR bs.is_temporary THEN 's3 bucket'
          ELSE REGEXP_REPLACE(LOWER(COALESCE(bs.source_type, '')), '[_-]+', ' ', 'g')
        END
      ) ILIKE :searchPattern
    )`);
    replacements.searchPattern = `%${query.search}%`;
  }

  const statusRawValues = resolveStatusFilterRawValues(query.status);
  if (statusRawValues && statusRawValues.length > 0) {
    clauses.push("bir.status IN (:statusRawValues)");
    replacements.statusRawValues = statusRawValues;
  }

  if (query.sourceType) {
    clauses.push("bs.source_type = :sourceType");
    replacements.sourceType = query.sourceType;
  }

  if (query.clientId) {
    clauses.push("bs.tenant_id = :clientId");
    replacements.clientId = query.clientId;
  }

  if (query.dateFrom) {
    clauses.push("bir.created_at >= :dateFrom");
    replacements.dateFrom = query.dateFrom.toISOString();
  }

  if (query.dateTo) {
    clauses.push("bir.created_at <= :dateTo");
    replacements.dateTo = query.dateTo.toISOString();
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    replacements,
  };
};

export async function getAdminBillingUploads(
  query: AdminBillingUploadsListQuery,
): Promise<AdminBillingUploadsListResult> {
  const parsedQuery = parseListQuery(query);
  const offset = (parsedQuery.page - 1) * parsedQuery.limit;

  const sortColumn = SORT_FIELD_MAP[parsedQuery.sortBy];
  const sortDirection = parsedQuery.sortOrder.toUpperCase();

  const { whereSql, replacements } = buildListWhere(parsedQuery);

  const [countRow] = await sequelize.query<TotalCountRow>(
    `
      SELECT COUNT(*)::bigint AS total
      FROM billing_ingestion_runs bir
      JOIN raw_billing_files rbf ON rbf.id = bir.raw_billing_file_id
      JOIN billing_sources bs ON bs.id = bir.billing_source_id
      LEFT JOIN tenants t ON t.id::text = bs.tenant_id
      LEFT JOIN users u ON u.id = rbf.uploaded_by
      ${whereSql}
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );

  const rows = await sequelize.query<ListQueryRow>(
    `
      SELECT
        bir.id AS run_id,
        bs.tenant_id,
        NULLIF(TRIM(t.name), '') AS tenant_name,
        NULLIF(TRIM(u.full_name), '') AS uploaded_by_name,
        bs.source_type,
        bs.setup_mode,
        bs.is_temporary,
        rbf.original_file_name AS file_name,
        rbf.file_format,
        bir.status AS run_status,
        bir.progress_percent,
        bir.started_at,
        bir.finished_at,
        bir.rows_failed,
        COALESCE(row_errors.row_error_count, 0) AS row_error_count
      FROM billing_ingestion_runs bir
      JOIN raw_billing_files rbf ON rbf.id = bir.raw_billing_file_id
      JOIN billing_sources bs ON bs.id = bir.billing_source_id
      LEFT JOIN tenants t ON t.id::text = bs.tenant_id
      LEFT JOIN users u ON u.id = rbf.uploaded_by
      LEFT JOIN (
        SELECT ingestion_run_id, COUNT(*)::int AS row_error_count
        FROM billing_ingestion_row_errors
        GROUP BY ingestion_run_id
      ) row_errors ON row_errors.ingestion_run_id = bir.id
      ${whereSql}
      ORDER BY ${sortColumn} ${sortDirection}, bir.id DESC
      LIMIT :limit OFFSET :offset
    `,
    {
      replacements: {
        ...replacements,
        limit: parsedQuery.limit,
        offset,
      },
      type: QueryTypes.SELECT,
    },
  );

  const total = Number(countRow?.total ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / parsedQuery.limit);

  return {
    data: rows.map((row) => mapListRow(row)),
    pagination: {
      page: parsedQuery.page,
      limit: parsedQuery.limit,
      total,
      totalPages,
    },
    filters: {
      status: parsedQuery.status,
      sourceType: parsedQuery.sourceType,
      clientId: parsedQuery.clientId,
      search: parsedQuery.search,
    },
    sort: {
      sortBy: parsedQuery.sortBy,
      sortOrder: parsedQuery.sortOrder,
    },
  };
}

const parseRunId = (runId: string): number => {
  const normalized = String(runId ?? "").trim();
  if (!/^\d+$/.test(normalized)) {
    throw new BadRequestError("Invalid runId");
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new BadRequestError("Invalid runId");
  }

  return parsed;
};

const mapDetails = (input: {
  row: DetailQueryRow;
  sampleRowErrors: RowErrorSampleRow[];
  relatedFiles: RelatedFileRow[];
}): AdminBillingUploadDetails => {
  const { row, sampleRowErrors, relatedFiles } = input;
  const normalizedStatus = normalizeStatus(row.run_status);

  return {
    runOverview: {
      runId: Number(row.run_id),
      status: {
        raw: String(row.run_status),
        normalized: normalizedStatus,
        label: getStatusLabel(normalizedStatus),
      },
      currentStep: row.current_step,
      progressPercent: Number(row.progress_percent ?? 0),
      statusMessage: row.status_message,
      startedAt: toIsoOrNull(row.started_at),
      finishedAt: toIsoOrNull(row.finished_at),
      createdAt: new Date(row.run_created_at).toISOString(),
      updatedAt: new Date(row.run_updated_at).toISOString(),
      lastHeartbeatAt: toIsoOrNull(row.last_heartbeat_at),
    },
    client: {
      id: String(row.tenant_id),
      name: String(row.tenant_name ?? "Unknown"),
    },
    sourceContext: {
      billingSourceId: Number(row.billing_source_id),
      sourceName: String(row.source_name),
      sourceType: String(row.source_type),
      setupMode: String(row.setup_mode),
      isTemporary: Boolean(row.is_temporary),
      sourceStatus: String(row.source_status),
      cloudProvider: {
        id: Number(row.provider_id),
        code: String(row.provider_code),
        name: String(row.provider_name),
      },
      cloudConnectionId: row.cloud_connection_id,
    },
    fileContext: {
      rawBillingFileId: Number(row.raw_billing_file_id),
      originalFileName: String(row.original_file_name),
      originalFilePath: row.original_file_path,
      fileFormat: String(row.file_format),
      fileSizeBytes: toIntOrNull(row.file_size_bytes),
      checksum: row.checksum,
      uploadedAt: new Date(row.file_created_at).toISOString(),
      uploadedBy: row.uploaded_by_id
        ? {
            id: String(row.uploaded_by_id),
            fullName: String(row.uploaded_by_name ?? ""),
            email: String(row.uploaded_by_email ?? ""),
          }
        : null,
    },
    rawStorageContext: {
      bucket: String(row.raw_storage_bucket ?? ""),
      key: String(row.raw_storage_key ?? ""),
      status: String(row.file_status ?? ""),
      persistedToRawStorage:
        Boolean(row.raw_storage_bucket) && Boolean(row.raw_storage_key) && String(row.file_status) === "stored",
    },
    processingMetrics: {
      rowsRead: Number(row.rows_read ?? 0),
      rowsLoaded: Number(row.rows_loaded ?? 0),
      rowsFailed: Number(row.rows_failed ?? 0),
      totalRowsEstimated: row.total_rows_estimated === null ? null : Number(row.total_rows_estimated),
    },
    failureDetails: {
      errorMessage: row.run_error_message,
      rowErrorCount: Number(row.row_error_count ?? 0),
      sampleRowErrors: sampleRowErrors.map((errorRow) => ({
        id: Number(errorRow.id),
        rowNumber: errorRow.row_number,
        errorCode: errorRow.error_code,
        errorMessage: String(errorRow.error_message),
        createdAt: new Date(errorRow.created_at).toISOString(),
      })),
    },
    relatedFiles: relatedFiles.map((fileRow) => ({
      rawBillingFileId: Number(fileRow.raw_billing_file_id),
      fileRole: String(fileRow.file_role),
      processingOrder: Number(fileRow.processing_order),
      originalFileName: String(fileRow.original_file_name),
      fileFormat: String(fileRow.file_format),
      status: String(fileRow.status),
    })),
  };
};

export async function getAdminBillingUploadDetails(runIdInput: string): Promise<AdminBillingUploadDetails> {
  const runId = parseRunId(runIdInput);

  const [detailRow] = await sequelize.query<DetailQueryRow>(
    `
      SELECT
        bir.id AS run_id,
        bir.status AS run_status,
        bir.current_step,
        bir.progress_percent,
        bir.status_message,
        bir.started_at,
        bir.finished_at,
        bir.created_at AS run_created_at,
        bir.updated_at AS run_updated_at,
        bir.last_heartbeat_at,
        bir.rows_read,
        bir.rows_loaded,
        bir.rows_failed,
        bir.total_rows_estimated,
        bir.error_message AS run_error_message,

        bs.tenant_id,
        COALESCE(t.name, 'Unknown') AS tenant_name,

        bs.id AS billing_source_id,
        bs.source_name,
        bs.source_type,
        bs.setup_mode,
        bs.is_temporary,
        bs.status AS source_status,
        bs.cloud_connection_id,

        cp.id AS provider_id,
        cp.code AS provider_code,
        cp.name AS provider_name,

        rbf.id AS raw_billing_file_id,
        rbf.original_file_name,
        rbf.original_file_path,
        rbf.file_format,
        rbf.file_size_bytes,
        rbf.checksum,
        rbf.created_at AS file_created_at,
        rbf.status AS file_status,
        rbf.raw_storage_bucket,
        rbf.raw_storage_key,

        u.id AS uploaded_by_id,
        u.full_name AS uploaded_by_name,
        u.email AS uploaded_by_email,

        COALESCE(row_errors.row_error_count, 0) AS row_error_count
      FROM billing_ingestion_runs bir
      JOIN raw_billing_files rbf ON rbf.id = bir.raw_billing_file_id
      JOIN billing_sources bs ON bs.id = bir.billing_source_id
      LEFT JOIN tenants t ON t.id::text = bs.tenant_id
      LEFT JOIN users u ON u.id = rbf.uploaded_by
      LEFT JOIN cloud_providers cp ON cp.id = bs.cloud_provider_id
      LEFT JOIN (
        SELECT ingestion_run_id, COUNT(*)::int AS row_error_count
        FROM billing_ingestion_row_errors
        GROUP BY ingestion_run_id
      ) row_errors ON row_errors.ingestion_run_id = bir.id
      WHERE bir.id = :runId
      LIMIT 1
    `,
    {
      replacements: { runId },
      type: QueryTypes.SELECT,
    },
  );

  if (!detailRow) {
    throw new NotFoundError("Billing ingestion run not found");
  }

  const sampleRowErrors = await sequelize.query<RowErrorSampleRow>(
    `
      SELECT
        id,
        row_number,
        error_code,
        error_message,
        created_at
      FROM billing_ingestion_row_errors
      WHERE ingestion_run_id = :runId
      ORDER BY created_at DESC, id DESC
      LIMIT 10
    `,
    {
      replacements: { runId },
      type: QueryTypes.SELECT,
    },
  );

  const relatedFiles = await sequelize.query<RelatedFileRow>(
    `
      SELECT
        birf.raw_billing_file_id,
        birf.file_role,
        birf.processing_order,
        rbf.original_file_name,
        rbf.file_format,
        rbf.status
      FROM billing_ingestion_run_files birf
      JOIN raw_billing_files rbf ON rbf.id = birf.raw_billing_file_id
      WHERE birf.ingestion_run_id = :runId
      ORDER BY birf.processing_order ASC, birf.id ASC
    `,
    {
      replacements: { runId },
      type: QueryTypes.SELECT,
    },
  );

  return mapDetails({
    row: detailRow,
    sampleRowErrors,
    relatedFiles,
  });
}
