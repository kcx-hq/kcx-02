import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { UnauthorizedError } from "../../../errors/http-errors.js";
import { sendSuccess } from "../../../utils/api-response.js";

import {
  createManualAnomalyDetectionJob,
  getAnomalyDetectionJobStatusForTenant,
} from "./anomaly-jobs.service.js";
import { getAnomaliesForTenant } from "./anomaly-read.service.js";
import { parseAnomalyListQuery, parseCreateAnomalyJobPayload, parseAnomalyJobIdParams } from "./anomaly.schema.js";

const requireTenantContext = (req: Request): { tenantId: string; userId: string | null } => {
  const tenantId = req.auth?.user.tenantId?.trim();
  if (!tenantId) {
    throw new UnauthorizedError("Tenant context required");
  }

  const authUserId = req.auth?.user.id;
  return {
    tenantId,
    userId: authUserId === undefined || authUserId === null ? null : String(authUserId),
  };
};

export async function handleCreateAnomalyDetectionJob(req: Request, res: Response): Promise<void> {
  const context = requireTenantContext(req);
  const payload = parseCreateAnomalyJobPayload(req.body);

  const data = await createManualAnomalyDetectionJob({
    payload,
    context,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.CREATED,
    message: "Anomaly detection job created successfully",
    data,
  });
}

export async function handleGetAnomalyDetectionJobStatus(req: Request, res: Response): Promise<void> {
  const context = requireTenantContext(req);
  const { jobId } = parseAnomalyJobIdParams(req.params);

  const data = await getAnomalyDetectionJobStatusForTenant({
    jobId,
    tenantId: context.tenantId,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Anomaly detection job status loaded",
    data,
  });
}

export async function handleGetAnomalies(req: Request, res: Response): Promise<void> {
  const context = requireTenantContext(req);
  const query = parseAnomalyListQuery(req.query);

  const data = await getAnomaliesForTenant({
    tenantId: context.tenantId,
    query,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Anomalies loaded",
    data,
  });
}
