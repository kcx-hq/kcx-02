import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../../errors/http-errors.js";
import { CloudProvider } from "../../models/index.js";
import { sendSuccess } from "../../utils/api-response.js";
import { getOrCreateManualSource } from "./services/billing-source.service.js";
import { createIngestionRun, getIngestionRunById } from "./services/ingestion.service.js";
import { detectFileFormat, storeManualFile } from "./services/raw-file.service.js";
import { ingestionOrchestrator } from "./services/ingestion-orchestrator.service.js";

const requireTenantId = (req: Request): string => {
  // Assumption: tenant context may come from auth middleware (`req.auth.user.tenantId`) or legacy context (`req.user.tenantId` / `req.tenantId`).
  const tenantId =
    req.auth?.user.tenantId ??
    (req as Request & { user?: { tenantId?: string } }).user?.tenantId ??
    (req as Request & { tenantId?: string }).tenantId;

  if (!tenantId || typeof tenantId !== "string") {
    throw new UnauthorizedError("Tenant context required");
  }
  return tenantId;
};

export async function handleManualUploadBillingFile(req: Request, res: Response): Promise<void> {
  const tenantId = requireTenantId(req);
  const { cloudProviderId } = req.body as { cloudProviderId?: string };

  if (!req.file) {
    throw new BadRequestError("Missing file in upload request");
  }

  if (!cloudProviderId || typeof cloudProviderId !== "string" || cloudProviderId.trim().length === 0) {
    throw new BadRequestError("Missing cloudProviderId");
  }

  const normalizedCloudProviderId = cloudProviderId.trim();
  if (!/^\d+$/.test(normalizedCloudProviderId)) {
    throw new BadRequestError("Invalid cloudProviderId");
  }

  const format = detectFileFormat(req.file.originalname);

  const billingSource = await getOrCreateManualSource({
    tenantId,
    cloudProviderId: normalizedCloudProviderId,
    format,
  });

  const storedFile = await storeManualFile({
    file: req.file,
    billingSourceId: billingSource.id,
    tenantId,
  });

  // Assumption: raw file persistence completes before ingestion-run enqueueing; cross-table transaction orchestration can be added in a later ingestion-processing phase.
  const ingestionRun = await createIngestionRun({
    billingSourceId: billingSource.id,
    rawBillingFileId: storedFile.rawFileId,
  });

  setImmediate(() => {
    ingestionOrchestrator.processIngestionRun(ingestionRun.id);
  });

  res.status(HTTP_STATUS.CREATED).json({
    billingSourceId: billingSource.id,
    rawFileId: storedFile.rawFileId,
    ingestionRunId: ingestionRun.id,
    bucket: storedFile.bucket,
    key: storedFile.key,
    format: storedFile.format,
    status: ingestionRun.status,
  });
}

export async function handleGetBillingIngestionRun(req: Request, res: Response): Promise<void> {
  requireTenantId(req);

  const runId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!runId || !/^\d+$/.test(runId)) {
    throw new BadRequestError("Invalid ingestion run id");
  }

  const run = await getIngestionRunById(runId);
  if (!run) {
    throw new NotFoundError("Billing ingestion run not found");
  }
  // Assumption: endpoint access is auth-protected; strict tenant-level ownership checks can be enforced when ingestion runs are joined/scoped through tenant-aware entities.

  res.status(HTTP_STATUS.OK).json({
    id: run.id,
    billing_source_id: run.billingSourceId,
    raw_billing_file_id: run.rawBillingFileId,
    status: run.status,
    rows_read: run.rowsRead,
    rows_loaded: run.rowsLoaded,
    rows_failed: run.rowsFailed,
    error_message: run.errorMessage,
    started_at: run.startedAt,
    finished_at: run.finishedAt,
    created_at: run.createdAt,
    updated_at: run.updatedAt,
  });
}

export async function handleGetBillingCloudProviders(req: Request, res: Response): Promise<void> {
  requireTenantId(req);

  const providers = await CloudProvider.findAll({
    attributes: ["id", "code", "name", "status"],
    where: { status: "active" },
    order: [["name", "ASC"]],
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cloud providers loaded",
    data: providers.map((provider) => ({
      id: provider.id,
      code: provider.code,
      name: provider.name,
    })),
  });
}
