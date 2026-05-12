import { logger } from "../../../../utils/logger.js";
import {
  EbsVolumeDailyRepository,
  type SyncEbsVolumeDailyParams,
} from "./ebs-volume-daily.repository.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const validateDateOnly = (value: string, field: "startDate" | "endDate"): void => {
  if (!DATE_ONLY_REGEX.test(value)) {
    throw new Error(`${field} must be in YYYY-MM-DD format`);
  }
};

export async function syncEbsVolumeDaily(params: SyncEbsVolumeDailyParams): Promise<{
  rowsUpserted: number;
  idleCount: number;
  unattachedCount: number;
  warningCount: number;
}> {
  validateDateOnly(params.startDate, "startDate");
  validateDateOnly(params.endDate, "endDate");
  if (params.startDate > params.endDate) {
    throw new Error("startDate must be less than or equal to endDate");
  }

  const startedAt = Date.now();
  logger.info("EBS volume daily sync started", {
    tenantId: params.tenantId ?? null,
    startDate: params.startDate,
    endDate: params.endDate,
  });

  const repository = new EbsVolumeDailyRepository();
  const result = await repository.syncEbsVolumeDaily(params);

  logger.info("EBS volume daily sync completed", {
    tenantId: params.tenantId ?? null,
    startDate: params.startDate,
    endDate: params.endDate,
    rowsProcessed: result.rowsUpserted,
    rowsUpserted: result.rowsUpserted,
    idleCount: result.idleCount,
    unattachedCount: result.unattachedCount,
    warningCount: result.warningCount,
    durationMs: Date.now() - startedAt,
  });

  return result;
}
