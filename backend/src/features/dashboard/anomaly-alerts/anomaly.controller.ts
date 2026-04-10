import type { Request, Response } from "express";

import { NotFoundError, UnauthorizedError } from "../../../errors/http-errors.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import { ANOMALY_DETECTOR_CONFIGS } from "./anomaly-detector.config.js";
import { runAnomalyDetectorsForDate } from "./anomaly.engine.js";
import { AnomalyRepository } from "./anomaly.repository.js";
import { listAnomaliesQuerySchema } from "./anomaly.schema.js";

const repository = new AnomalyRepository();

const requireTenantId = (req: Request): string => {
  const tenantId = req.auth?.user.tenantId;
  if (!tenantId || typeof tenantId !== "string") {
    throw new UnauthorizedError("Tenant context required");
  }
  return tenantId;
};

export async function handleGetAnomalies(req: Request, res: Response): Promise<void> {
  const tenantId = requireTenantId(req);
  const query = parseWithSchema(listAnomaliesQuerySchema, req.query);

  const anomalies = await repository.listAnomalies({
    tenantId,
    anomalyType: query.anomaly_type,
    severity: query.severity,
    status: query.status,
    dateFrom: query.date_from,
    dateTo: query.date_to,
    serviceKey: query.service,
    regionKey: query.region,
    subAccountKey: query.sub_account,
  });

  sendSuccess({
    req,
    res,
    message: "Anomalies loaded",
    data: anomalies,
  });
}

export async function handleGetAnomalyById(req: Request, res: Response): Promise<void> {
  const tenantId = requireTenantId(req);
  const id = String(req.params.id ?? "").trim();
  if (!id) {
    throw new NotFoundError("Anomaly not found");
  }

  const result = await repository.getAnomalyById(tenantId, id);
  if (!result) {
    throw new NotFoundError("Anomaly not found");
  }

  sendSuccess({
    req,
    res,
    message: "Anomaly loaded",
    data: result,
  });
}

export async function handleGetAnomalyDetectors(req: Request, res: Response): Promise<void> {
  requireTenantId(req);
  sendSuccess({
    req,
    res,
    message: "Anomaly detectors loaded",
    data: ANOMALY_DETECTOR_CONFIGS,
  });
}

export async function handleRunAnomalyDetectors(req: Request, res: Response): Promise<void> {
  requireTenantId(req);
  const usageDate = String(req.query.date ?? "").trim() || new Date().toISOString().slice(0, 10);
  const summary = await runAnomalyDetectorsForDate(usageDate);
  sendSuccess({
    req,
    res,
    message: "Anomaly detectors executed",
    data: summary,
  });
}
