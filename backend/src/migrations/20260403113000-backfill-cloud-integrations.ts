// @ts-nocheck
const hasTable = async (queryInterface, tableName) => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const hasIndex = async (queryInterface, tableName, indexName) => {
  try {
    const indexes = await queryInterface.showIndex(tableName);
    return indexes.some((index) => index.name === indexName);
  } catch {
    return false;
  }
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const normalizeAutomaticStatus = (value) => {
  const status = String(value ?? "").toLowerCase();
  if (
    status === "draft" ||
    status === "connecting" ||
    status === "awaiting_validation" ||
    status === "active" ||
    status === "active_with_warnings" ||
    status === "failed" ||
    status === "suspended"
  ) {
    return status;
  }
  return "draft";
};

const mapManualStatus = (row) => {
  const status = String(row.status ?? "").toLowerCase();
  const validationStatus = String(row.validation_status ?? "").toLowerCase();
  const assumeRoleSuccess = Boolean(row.assume_role_success);
  const hasError = Boolean(row.error_message && String(row.error_message).trim().length > 0);

  if (status === "failed" || validationStatus === "failed" || (!assumeRoleSuccess && hasError)) {
    return "failed";
  }
  if (assumeRoleSuccess) return "active";
  if (status === "awaiting_validation" || validationStatus === "pending") return "awaiting_validation";
  if (status === "suspended") return "suspended";
  return "draft";
};

const fallbackStatusMessage = (status, errorMessage) => {
  if (status === "failed") return (errorMessage && String(errorMessage).trim()) || "Connection Failed";
  if (status === "draft") return "Setup In Progress";
  if (status === "connecting") return "Connecting";
  if (status === "awaiting_validation") return "Awaiting Validation";
  if (status === "active") return "Pending First Ingest";
  if (status === "active_with_warnings") return "Warnings Detected";
  return "Suspended";
};

const buildDisplayNameCandidate = (baseName, mode, attempt) => {
  if (attempt === 0) return baseName;
  if (attempt === 1) return `${baseName} (${mode})`;
  return `${baseName} (${mode} ${attempt})`;
};

const resolveUniqueDisplayName = async ({
  queryInterface,
  tenantId,
  detailRecordType,
  detailRecordId,
  preferredDisplayName,
  connectionMode,
}) => {
  const baseName =
    String(preferredDisplayName ?? "").trim() || `${connectionMode}-${String(detailRecordId).slice(0, 8)}`;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = buildDisplayNameCandidate(baseName, connectionMode, attempt);
    const existingRows = await queryInterface.sequelize.query(
      `
SELECT detail_record_type, detail_record_id
FROM cloud_integrations
WHERE tenant_id = :tenantId
  AND display_name = :displayName
LIMIT 1
`,
      {
        replacements: {
          tenantId,
          displayName: candidate,
        },
      },
    );

    const existing = existingRows?.[0]?.[0] ?? null;
    if (!existing) return candidate;
    if (
      existing.detail_record_type === detailRecordType &&
      existing.detail_record_id === detailRecordId
    ) {
      return candidate;
    }
  }

  return `${baseName} (${connectionMode}-${String(detailRecordId).slice(0, 8)})`;
};

const upsertCloudIntegration = async ({ queryInterface, row }) => {
  const displayName = await resolveUniqueDisplayName({
    queryInterface,
    tenantId: row.tenant_id,
    detailRecordType: row.detail_record_type,
    detailRecordId: row.detail_record_id,
    preferredDisplayName: row.display_name,
    connectionMode: row.connection_mode,
  });

  await queryInterface.sequelize.query(
    `
INSERT INTO cloud_integrations (
  tenant_id,
  created_by,
  provider_id,
  connection_mode,
  display_name,
  status,
  detail_record_id,
  detail_record_type,
  cloud_account_id,
  payer_account_id,
  last_validated_at,
  last_success_at,
  last_checked_at,
  status_message,
  error_message,
  connected_at,
  created_at,
  updated_at
)
VALUES (
  :tenantId,
  :createdBy,
  :providerId,
  :connectionMode,
  :displayName,
  :status,
  :detailRecordId,
  :detailRecordType,
  :cloudAccountId,
  :payerAccountId,
  :lastValidatedAt,
  :lastSuccessAt,
  :lastCheckedAt,
  :statusMessage,
  :errorMessage,
  :connectedAt,
  :createdAt,
  :updatedAt
)
ON CONFLICT (detail_record_type, detail_record_id)
DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  created_by = EXCLUDED.created_by,
  provider_id = EXCLUDED.provider_id,
  connection_mode = EXCLUDED.connection_mode,
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status,
  cloud_account_id = EXCLUDED.cloud_account_id,
  payer_account_id = EXCLUDED.payer_account_id,
  last_validated_at = EXCLUDED.last_validated_at,
  last_success_at = EXCLUDED.last_success_at,
  last_checked_at = EXCLUDED.last_checked_at,
  status_message = EXCLUDED.status_message,
  error_message = EXCLUDED.error_message,
  connected_at = EXCLUDED.connected_at,
  updated_at = EXCLUDED.updated_at
`,
    {
      replacements: {
        tenantId: row.tenant_id,
        createdBy: row.created_by,
        providerId: row.provider_id,
        connectionMode: row.connection_mode,
        displayName,
        status: row.status,
        detailRecordId: row.detail_record_id,
        detailRecordType: row.detail_record_type,
        cloudAccountId: row.cloud_account_id,
        payerAccountId: row.payer_account_id,
        lastValidatedAt: row.last_validated_at,
        lastSuccessAt: row.last_success_at,
        lastCheckedAt: row.last_checked_at,
        statusMessage: row.status_message,
        errorMessage: row.error_message,
        connectedAt: row.connected_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    },
  );
};

const ensureAwsProviderId = async (queryInterface) => {
  const existingRows = await queryInterface.sequelize.query(
    `SELECT id FROM cloud_providers WHERE code = 'aws' LIMIT 1`,
  );
  const existing = existingRows?.[0]?.[0] ?? null;
  if (existing?.id) return String(existing.id);

  const insertedRows = await queryInterface.sequelize.query(
    `
INSERT INTO cloud_providers (code, name, status, created_at, updated_at)
VALUES ('aws', 'Amazon Web Services', 'active', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
RETURNING id
`,
  );
  const inserted = insertedRows?.[0]?.[0] ?? null;
  return String(inserted.id);
};

const migration = {
  async up(queryInterface) {
    if (!(await hasTable(queryInterface, "cloud_integrations"))) return;

    await queryInterface.sequelize.query(`
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY detail_record_type, detail_record_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_number
  FROM cloud_integrations
)
DELETE FROM cloud_integrations ci
USING ranked r
WHERE ci.id = r.id
  AND r.row_number > 1;
`);

    if (await hasIndex(queryInterface, "cloud_integrations", "idx_cloud_integrations_detail_record")) {
      await queryInterface.removeIndex("cloud_integrations", "idx_cloud_integrations_detail_record");
    }
    if (!(await hasIndex(queryInterface, "cloud_integrations", "uq_cloud_integrations_detail_record"))) {
      await queryInterface.addIndex("cloud_integrations", ["detail_record_type", "detail_record_id"], {
        name: "uq_cloud_integrations_detail_record",
        unique: true,
      });
    }

    if (await hasTable(queryInterface, "manual_cloud_connections")) {
      const awsProviderId = await ensureAwsProviderId(queryInterface);
      const manualRowsResult = await queryInterface.sequelize.query(`
SELECT
  id,
  tenant_id,
  created_by,
  connection_name,
  aws_account_id,
  last_validated_at,
  validation_status,
  assume_role_success,
  error_message,
  status,
  created_at,
  updated_at
FROM manual_cloud_connections
`);
      const manualRows = manualRowsResult?.[0] ?? [];

      for (const manualRow of manualRows) {
        const mappedStatus = mapManualStatus(manualRow);
        const lastValidatedAt = toIsoOrNull(manualRow.last_validated_at);
        const lastCheckedAt =
          lastValidatedAt || toIsoOrNull(manualRow.updated_at) || toIsoOrNull(manualRow.created_at);
        const connectedAt = mappedStatus === "active" ? lastValidatedAt : null;
        const lastSuccessAt = mappedStatus === "active" ? lastValidatedAt : null;

        await upsertCloudIntegration({
          queryInterface,
          row: {
            tenant_id: manualRow.tenant_id,
            created_by: manualRow.created_by ?? null,
            provider_id: awsProviderId,
            connection_mode: "manual",
            display_name: manualRow.connection_name,
            status: mappedStatus,
            detail_record_id: manualRow.id,
            detail_record_type: "manual_cloud_connection",
            cloud_account_id: manualRow.aws_account_id ?? null,
            payer_account_id: null,
            last_validated_at: lastValidatedAt,
            last_success_at: lastSuccessAt,
            last_checked_at: lastCheckedAt,
            status_message: fallbackStatusMessage(mappedStatus, manualRow.error_message),
            error_message: manualRow.error_message ?? null,
            connected_at: connectedAt,
            created_at: toIsoOrNull(manualRow.created_at) || new Date().toISOString(),
            updated_at: toIsoOrNull(manualRow.updated_at) || new Date().toISOString(),
          },
        });
      }
    }

    if (await hasTable(queryInterface, "cloud_connections")) {
      const automaticRowsResult = await queryInterface.sequelize.query(`
SELECT
  id,
  tenant_id,
  created_by,
  provider_id,
  connection_name,
  status,
  cloud_account_id,
  payer_account_id,
  last_validated_at,
  connected_at,
  error_message,
  created_at,
  updated_at
FROM cloud_connections
`);
      const automaticRows = automaticRowsResult?.[0] ?? [];

      for (const automaticRow of automaticRows) {
        const mappedStatus = normalizeAutomaticStatus(automaticRow.status);
        const lastValidatedAt = toIsoOrNull(automaticRow.last_validated_at);
        const lastCheckedAt =
          lastValidatedAt || toIsoOrNull(automaticRow.updated_at) || toIsoOrNull(automaticRow.created_at);
        const lastSuccessAt =
          mappedStatus === "active" || mappedStatus === "active_with_warnings" ? lastValidatedAt : null;

        await upsertCloudIntegration({
          queryInterface,
          row: {
            tenant_id: automaticRow.tenant_id,
            created_by: automaticRow.created_by ?? null,
            provider_id: String(automaticRow.provider_id),
            connection_mode: "automatic",
            display_name: automaticRow.connection_name,
            status: mappedStatus,
            detail_record_id: automaticRow.id,
            detail_record_type: "automatic_cloud_connection",
            cloud_account_id: automaticRow.cloud_account_id ?? null,
            payer_account_id: automaticRow.payer_account_id ?? null,
            last_validated_at: lastValidatedAt,
            last_success_at: lastSuccessAt,
            last_checked_at: lastCheckedAt,
            status_message: fallbackStatusMessage(mappedStatus, automaticRow.error_message),
            error_message: automaticRow.error_message ?? null,
            connected_at: toIsoOrNull(automaticRow.connected_at),
            created_at: toIsoOrNull(automaticRow.created_at) || new Date().toISOString(),
            updated_at: toIsoOrNull(automaticRow.updated_at) || new Date().toISOString(),
          },
        });
      }
    }
  },

  async down(queryInterface) {
    if (!(await hasTable(queryInterface, "cloud_integrations"))) return;
    if (await hasIndex(queryInterface, "cloud_integrations", "uq_cloud_integrations_detail_record")) {
      await queryInterface.removeIndex("cloud_integrations", "uq_cloud_integrations_detail_record");
    }
    if (!(await hasIndex(queryInterface, "cloud_integrations", "idx_cloud_integrations_detail_record"))) {
      await queryInterface.addIndex("cloud_integrations", ["detail_record_type", "detail_record_id"], {
        name: "idx_cloud_integrations_detail_record",
      });
    }
  },
};

export default migration;
