import { logger } from "../../../../utils/logger.js";
import {
  Ec2InstanceDailyFactRepository,
  type SyncEc2InstanceDailyFactParams,
} from "./ec2-instance-daily-fact.repository.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const validateDateOnly = (value: string, field: "startDate" | "endDate"): void => {
  if (!DATE_ONLY_REGEX.test(value)) {
    throw new Error(`${field} must be in YYYY-MM-DD format`);
  }
};

export async function syncEc2InstanceDailyFact(params: SyncEc2InstanceDailyFactParams): Promise<{ rowsUpserted: number }> {
  validateDateOnly(params.startDate, "startDate");
  validateDateOnly(params.endDate, "endDate");
  if (params.startDate > params.endDate) {
    throw new Error("startDate must be less than or equal to endDate");
  }

  const startedAt = Date.now();
  logger.info("EC2 instance daily unified fact sync started", {
    tenantId: params.tenantId ?? null,
    cloudConnectionId: params.cloudConnectionId ?? null,
    providerId: params.providerId ?? null,
    startDate: params.startDate,
    endDate: params.endDate,
  });

  const repository = new Ec2InstanceDailyFactRepository();
  const result = await repository.syncEc2InstanceDailyFact(params);

  logger.info("EC2 instance daily unified fact sync completed", {
    tenantId: params.tenantId ?? null,
    cloudConnectionId: params.cloudConnectionId ?? null,
    providerId: params.providerId ?? null,
    startDate: params.startDate,
    endDate: params.endDate,
    rowsUpserted: result.rowsUpserted,
    durationMs: Date.now() - startedAt,
  });

  return result;
}
