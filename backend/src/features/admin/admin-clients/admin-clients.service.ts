import { BillingIngestionRun, BillingSource, CloudIntegration, CloudProvider, RawBillingFile, Tenant, User } from "../../../models/index.js";

type UserInstance = InstanceType<typeof User>;
type TenantInstance = InstanceType<typeof Tenant>;
type CloudIntegrationInstance = InstanceType<typeof CloudIntegration>;
type CloudProviderInstance = InstanceType<typeof CloudProvider>;
type BillingSourceInstance = InstanceType<typeof BillingSource>;
type RawBillingFileInstance = InstanceType<typeof RawBillingFile>;
type BillingIngestionRunInstance = InstanceType<typeof BillingIngestionRun>;
const SUCCESS_RUN_STATUSES = new Set(["completed", "success", "succeeded"]);

type AdminClientPlatformContext = {
  cloudConnection: {
    exists: boolean;
    providerName: string | null;
    status: string | null;
    setupType: string | null;
    cloudAccountId: string | null;
    lastValidatedAt: string | null;
    lastSuccessAt: string | null;
    lastCheckedAt: string | null;
  };
  billing: {
    sourceExists: boolean;
    dataExists: boolean;
    lastUploadAt: string | null;
    lastIngestedAt: string | null;
    totalFiles: number;
    totalFilesUploaded: number;
    totalFilesProcessed: number;
    totalFilesIngested: number;
    latestRunStatus: string | null;
    latestRunAt: string | null;
    latestRunErrorSummary: string | null;
    latestRunFailedRows: number | null;
    latestFileName: string | null;
  };
};

export type AdminClientV1 = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  tenant: {
    name: string | null;
    slug: string | null;
    status: string | null;
  };
  platformContext: AdminClientPlatformContext;
};

const getTenant = (user: UserInstance): TenantInstance | null => {
  return (user as unknown as { Tenant?: TenantInstance }).Tenant ?? null;
};

const getCloudProvider = (integration: CloudIntegrationInstance): CloudProviderInstance | null => {
  return (integration as unknown as { CloudProvider?: CloudProviderInstance }).CloudProvider ?? null;
};

const toIsoOrNull = (value: Date | null | undefined): string | null => {
  if (!value) return null;
  return value.toISOString();
};

const toNumberOrNull = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};

const buildDefaultPlatformContext = (): AdminClientPlatformContext => ({
  cloudConnection: {
    exists: false,
    providerName: null,
    status: null,
    setupType: null,
    cloudAccountId: null,
    lastValidatedAt: null,
    lastSuccessAt: null,
    lastCheckedAt: null,
  },
  billing: {
    sourceExists: false,
    dataExists: false,
    lastUploadAt: null,
    lastIngestedAt: null,
    totalFiles: 0,
    totalFilesUploaded: 0,
    totalFilesProcessed: 0,
    totalFilesIngested: 0,
    latestRunStatus: null,
    latestRunAt: null,
    latestRunErrorSummary: null,
    latestRunFailedRows: null,
    latestFileName: null,
  },
});

const toClientSummary = (
  user: UserInstance,
  platformContextByTenantId: Map<string, AdminClientPlatformContext>,
): AdminClientV1 => {
  const tenant = getTenant(user);
  const platformContext = platformContextByTenantId.get(user.tenantId) ?? buildDefaultPlatformContext();

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    tenant: {
      name: tenant?.name ?? null,
      slug: tenant?.slug ?? null,
      status: tenant?.status ?? null,
    },
    platformContext,
  };
};

export async function getAdminClients(): Promise<AdminClientV1[]> {
  const users = await User.findAll({
    order: [["createdAt", "DESC"]],
    include: [{ model: Tenant }],
  });

  const tenantIds = Array.from(new Set(users.map((user) => user.tenantId).filter(Boolean)));
  const platformContextByTenantId = new Map<string, AdminClientPlatformContext>();

  if (tenantIds.length > 0) {
    const [cloudIntegrations, billingSources, rawBillingFiles] = await Promise.all([
      CloudIntegration.findAll({
        where: { tenantId: tenantIds },
        include: [{ model: CloudProvider, attributes: ["name"] }],
        order: [["updatedAt", "DESC"]],
      }),
      BillingSource.findAll({
        where: { tenantId: tenantIds },
        order: [["updatedAt", "DESC"]],
      }),
      RawBillingFile.findAll({
        where: { tenantId: tenantIds },
        order: [["createdAt", "DESC"]],
      }),
    ]);

    const billingSourceIds = billingSources.map((source) => String(source.id));
    const ingestionRuns = billingSourceIds.length
      ? await BillingIngestionRun.findAll({
        where: { billingSourceId: billingSourceIds },
        order: [["updatedAt", "DESC"]],
      })
      : [];

    const latestCloudByTenantId = new Map<string, CloudIntegrationInstance>();
    for (const integration of cloudIntegrations) {
      if (!latestCloudByTenantId.has(integration.tenantId)) {
        latestCloudByTenantId.set(integration.tenantId, integration);
      }
    }

    const billingSourcesByTenantId = new Map<string, BillingSourceInstance[]>();
    for (const source of billingSources) {
      const list = billingSourcesByTenantId.get(source.tenantId) ?? [];
      list.push(source);
      billingSourcesByTenantId.set(source.tenantId, list);
    }

    const latestRawFileByTenantId = new Map<string, RawBillingFileInstance>();
    const totalUploadedFilesByTenantId = new Map<string, number>();
    for (const rawFile of rawBillingFiles) {
      if (!latestRawFileByTenantId.has(rawFile.tenantId)) {
        latestRawFileByTenantId.set(rawFile.tenantId, rawFile);
      }
      totalUploadedFilesByTenantId.set(rawFile.tenantId, (totalUploadedFilesByTenantId.get(rawFile.tenantId) ?? 0) + 1);
    }

    const tenantIdByBillingSourceId = new Map<string, string>();
    for (const source of billingSources) {
      tenantIdByBillingSourceId.set(String(source.id), source.tenantId);
    }

    const latestRunByTenantId = new Map<string, BillingIngestionRunInstance>();
    const processedRawFileIdsByTenantId = new Map<string, Set<string>>();
    const ingestedRawFileIdsByTenantId = new Map<string, Set<string>>();
    for (const run of ingestionRuns) {
      const tenantId = tenantIdByBillingSourceId.get(String(run.billingSourceId));
      if (!tenantId) continue;
      if (!latestRunByTenantId.has(tenantId)) {
        latestRunByTenantId.set(tenantId, run);
      }
      const processedSet = processedRawFileIdsByTenantId.get(tenantId) ?? new Set<string>();
      processedSet.add(String(run.rawBillingFileId));
      processedRawFileIdsByTenantId.set(tenantId, processedSet);

      const normalizedRunStatus = String(run.status ?? "").toLowerCase();
      if (SUCCESS_RUN_STATUSES.has(normalizedRunStatus)) {
        const ingestedSet = ingestedRawFileIdsByTenantId.get(tenantId) ?? new Set<string>();
        ingestedSet.add(String(run.rawBillingFileId));
        ingestedRawFileIdsByTenantId.set(tenantId, ingestedSet);
      }
    }

    for (const tenantId of tenantIds) {
      const latestIntegration = latestCloudByTenantId.get(tenantId) ?? null;
      const cloudProvider = latestIntegration ? getCloudProvider(latestIntegration) : null;

      const sources = billingSourcesByTenantId.get(tenantId) ?? [];
      const latestSourceWithFileReceivedAt = sources.find((source) => Boolean(source.lastFileReceivedAt)) ?? null;
      const latestSourceWithIngestedAt = sources.find((source) => Boolean(source.lastIngestedAt)) ?? null;
      const latestRawFile = latestRawFileByTenantId.get(tenantId) ?? null;
      const latestRun = latestRunByTenantId.get(tenantId) ?? null;
      const totalFilesUploaded = totalUploadedFilesByTenantId.get(tenantId) ?? 0;
      const totalFilesProcessed = processedRawFileIdsByTenantId.get(tenantId)?.size ?? 0;
      const totalFilesIngested = ingestedRawFileIdsByTenantId.get(tenantId)?.size ?? 0;

      platformContextByTenantId.set(tenantId, {
        cloudConnection: {
          exists: latestIntegration !== null,
          providerName: cloudProvider?.name ?? null,
          status: latestIntegration?.status ?? null,
          setupType: latestIntegration?.connectionMode ?? null,
          cloudAccountId: latestIntegration?.cloudAccountId ?? null,
          lastValidatedAt: toIsoOrNull(latestIntegration?.lastValidatedAt),
          lastSuccessAt: toIsoOrNull(latestIntegration?.lastSuccessAt),
          lastCheckedAt: toIsoOrNull(latestIntegration?.lastCheckedAt),
        },
        billing: {
          sourceExists: sources.length > 0,
          dataExists:
            latestRawFile !== null || latestSourceWithFileReceivedAt !== null || latestSourceWithIngestedAt !== null,
          lastUploadAt: toIsoOrNull(latestRawFile?.createdAt ?? latestSourceWithFileReceivedAt?.lastFileReceivedAt),
          lastIngestedAt: toIsoOrNull(latestSourceWithIngestedAt?.lastIngestedAt),
          totalFiles: totalFilesUploaded,
          totalFilesUploaded,
          totalFilesProcessed,
          totalFilesIngested,
          latestRunStatus: latestRun?.status ?? null,
          latestRunAt: toIsoOrNull(latestRun?.finishedAt ?? latestRun?.updatedAt ?? latestRun?.startedAt ?? latestRun?.createdAt),
          latestRunErrorSummary: latestRun?.errorMessage ?? latestRun?.statusMessage ?? null,
          latestRunFailedRows: toNumberOrNull(latestRun?.rowsFailed),
          latestFileName: latestRawFile?.originalFileName ?? null,
        },
      });
    }
  }

  return users.map((user) => toClientSummary(user, platformContextByTenantId));
}
