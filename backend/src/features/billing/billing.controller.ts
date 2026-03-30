import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { BadRequestError, UnauthorizedError } from "../../errors/http-errors.js";
import { CloudProvider } from "../../models/index.js";
import { sendSuccess } from "../../utils/api-response.js";
import { getOrCreateManualSource } from "./services/billing-source.service.js";
import { detectFileFormat, storeManualFile } from "./services/raw-file.service.js";

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
  const format = detectFileFormat(req.file.originalname);

  const billingSource = await getOrCreateManualSource({
    tenantId,
    // Assumption: current schema uses UUID provider IDs from `cloud_providers.id`.
    cloudProviderId: normalizedCloudProviderId,
    format,
  });

  const result = await storeManualFile({
    file: req.file,
    billingSourceId: billingSource.id,
    tenantId,
  });

  res.status(HTTP_STATUS.CREATED).json({
    billingSourceId: billingSource.id,
    rawFileId: result.rawFileId,
    bucket: result.bucket,
    key: result.key,
    format: result.format,
    status: result.status,
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
