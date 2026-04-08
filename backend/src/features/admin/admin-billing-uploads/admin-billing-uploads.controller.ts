import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { getAdminBillingUploadDetails, getAdminBillingUploads } from "./admin-billing-uploads.service.js";
import type { AdminBillingUploadsListQuery } from "./admin-billing-uploads.types.js";

export async function handleAdminGetBillingUploads(req: Request, res: Response): Promise<void> {
  const data = await getAdminBillingUploads(req.query as AdminBillingUploadsListQuery);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Billing uploads fetched",
    data,
  });
}

export async function handleAdminGetBillingUploadByRunId(req: Request, res: Response): Promise<void> {
  const runIdParam = req.params.runId;
  const runId = Array.isArray(runIdParam) ? runIdParam[0] : runIdParam;
  const data = await getAdminBillingUploadDetails(runId);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Billing upload details fetched",
    data,
  });
}
