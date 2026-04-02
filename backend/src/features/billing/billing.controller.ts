import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../../errors/http-errors.js";
import { CloudProvider } from "../../models/index.js";
import { sendSuccess } from "../../utils/api-response.js";
import { getOrCreateManualSource } from "./services/billing-source.service.js";
import {
  createIngestionRun,
  getIngestionRunByIdForTenant,
  getLatestActiveIngestionRunForTenant,
  getLatestIngestionRunForSource,
  getUploadHistoryForTenant,
} from "./services/ingestion.service.js";
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
  await handleStartBillingIngestion(req, res);
}

const mapIngestionRunStatusResponse = (run: {
  id: string;
  status: string;
  currentStep: string | null;
  progressPercent: number;
  statusMessage: string | null;
  rowsRead: number;
  rowsLoaded: number;
  rowsFailed: number;
  totalRowsEstimated: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
  updatedAt: Date;
  lastHeartbeatAt: Date | null;
}) => ({
  id: run.id,
  status: run.status,
  currentStep: run.currentStep,
  progressPercent: run.progressPercent,
  statusMessage: run.statusMessage,
  rowsRead: run.rowsRead,
  rowsLoaded: run.rowsLoaded,
  rowsFailed: run.rowsFailed,
  totalRowsEstimated: run.totalRowsEstimated,
  startedAt: run.startedAt,
  finishedAt: run.finishedAt,
  errorMessage: run.errorMessage,
  lastUpdatedAt: run.updatedAt,
  lastHeartbeatAt: run.lastHeartbeatAt,
});

export async function handleStartBillingIngestion(req: Request, res: Response): Promise<void> {
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
    uploadedByUserId: typeof req.auth?.user.id === "string" ? req.auth.user.id : null,
  });

  // Assumption: raw file persistence completes before ingestion-run enqueueing; cross-table transaction orchestration can be added in a later ingestion-processing phase.
  const ingestionRun = await createIngestionRun({
    billingSourceId: billingSource.id,
    rawBillingFileId: storedFile.rawFileId,
  });

  setImmediate(() => {
    void ingestionOrchestrator.processIngestionRun(ingestionRun.id);
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.CREATED,
    message: "Billing ingestion queued",
    data: {
      ingestionRunId: ingestionRun.id,
      status: ingestionRun.status,
      billingSourceId: billingSource.id,
      rawFileId: storedFile.rawFileId,
      format: storedFile.format,
      startedAt: ingestionRun.startedAt,
    },
  });
}

export async function handleGetBillingIngestionRun(req: Request, res: Response): Promise<void> {
  await handleGetBillingIngestionStatus(req, res);
}

export async function handleGetBillingIngestionStatus(req: Request, res: Response): Promise<void> {
  const tenantId = requireTenantId(req);

  const runId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!runId || !/^\d+$/.test(runId)) {
    throw new BadRequestError("Invalid ingestion run id");
  }

  const run = await getIngestionRunByIdForTenant(runId, tenantId);
  if (!run) {
    throw new NotFoundError("Billing ingestion run not found");
  }

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Billing ingestion status loaded",
    data: mapIngestionRunStatusResponse(run),
  });
}

export async function handleGetLatestBillingIngestionForSource(req: Request, res: Response): Promise<void> {
  const tenantId = requireTenantId(req);
  const sourceId = Array.isArray(req.params.sourceId) ? req.params.sourceId[0] : req.params.sourceId;

  if (!sourceId || !/^\d+$/.test(sourceId)) {
    throw new BadRequestError("Invalid billing source id");
  }

  const run = await getLatestIngestionRunForSource({
    billingSourceId: sourceId,
    tenantId,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Latest ingestion loaded",
    data: run ? mapIngestionRunStatusResponse(run) : null,
  });
}

export async function handleGetLatestActiveBillingIngestion(req: Request, res: Response): Promise<void> {
  const tenantId = requireTenantId(req);
  const run = await getLatestActiveIngestionRunForTenant(tenantId);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Latest active ingestion loaded",
    data: run ? mapIngestionRunStatusResponse(run) : null,
  });
}

export async function handleGetBillingUploadHistory(req: Request, res: Response): Promise<void> {
  const tenantId = requireTenantId(req);
  const history = await getUploadHistoryForTenant(tenantId);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Billing upload history loaded",
    data: history,
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
