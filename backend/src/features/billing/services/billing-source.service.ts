import { BadRequestError, InternalServerError } from "../../../errors/http-errors.js";
import { BillingSource, CloudProvider } from "../../../models/index.js";

type BillingSourceInstance = InstanceType<typeof BillingSource>;

type FindManualSourceParams = {
  tenantId: string;
  cloudProviderId: string;
  format: "csv" | "parquet";
};

type CreateManualSourceParams = {
  tenantId: string;
  cloudProviderId: string;
  providerName: string;
  format: "csv" | "parquet";
};

type GetOrCreateManualSourceParams = {
  tenantId: string;
  cloudProviderId: string;
  format: "csv" | "parquet";
};

const normalizeCloudProviderIdOrThrow = (cloudProviderId: string): string => {
  const normalizedCloudProviderId = String(cloudProviderId ?? "").trim();

  if (!/^\d+$/.test(normalizedCloudProviderId)) {
    throw new BadRequestError("Invalid cloudProviderId");
  }

  return normalizedCloudProviderId;
};

export async function getProviderNameById(cloudProviderId: string): Promise<string> {
  const normalizedCloudProviderId = normalizeCloudProviderIdOrThrow(cloudProviderId);

  const provider = await CloudProvider.findByPk(normalizedCloudProviderId, {
    attributes: ["id", "name"],
  });

  if (!provider) {
    throw new BadRequestError("Invalid cloudProviderId");
  }

  return provider.name;
}

export async function findManualSource({
  tenantId,
  cloudProviderId,
  format,
}: FindManualSourceParams): Promise<BillingSourceInstance | null> {
  return BillingSource.findOne({
    where: {
      tenantId,
      cloudProviderId,
      sourceType: "manual_upload",
      setupMode: "manual",
      format,
    },
  });
}

export async function createManualSource({
  tenantId,
  cloudProviderId,
  providerName,
  format,
}: CreateManualSourceParams): Promise<BillingSourceInstance> {
  try {
    return await BillingSource.create({
      tenantId,
      cloudProviderId,
      sourceName: `Manual ${providerName.toUpperCase()} Upload`,
      sourceType: "manual_upload",
      setupMode: "manual",
      format,
      schemaType: "focus",
      cadence: "manual",
      status: "draft",
    });
  } catch (error) {
    throw new InternalServerError("Failed to create manual billing source", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getOrCreateManualSource({
  tenantId,
  cloudProviderId,
  format,
}: GetOrCreateManualSourceParams): Promise<BillingSourceInstance> {
  const normalizedCloudProviderId = normalizeCloudProviderIdOrThrow(cloudProviderId);
  const providerName = await getProviderNameById(normalizedCloudProviderId);
  const existingSource = await findManualSource({
    tenantId,
    cloudProviderId: normalizedCloudProviderId,
    format,
  });

  if (existingSource) {
    return existingSource;
  }

  return createManualSource({
    tenantId,
    cloudProviderId: normalizedCloudProviderId,
    providerName,
    format,
  });
}
