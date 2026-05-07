import { logger } from "../../../../utils/logger.js";
import {
  Ec2InstanceCostDailyRepository,
  type SyncEc2InstanceCostDailyParams,
} from "./ec2-instance-cost-daily.repository.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const validateDateOnly = (value: string, field: "startDate" | "endDate"): void => {
  if (!DATE_ONLY_REGEX.test(value)) {
    throw new Error(`${field} must be in YYYY-MM-DD format`);
  }
};

export async function syncEc2InstanceCostDaily(params: SyncEc2InstanceCostDailyParams): Promise<{ rowsUpserted: number }> {
  validateDateOnly(params.startDate, "startDate");
  validateDateOnly(params.endDate, "endDate");
  if (params.startDate > params.endDate) {
    throw new Error("startDate must be less than or equal to endDate");
  }

  const startedAt = Date.now();
  logger.info("EC2 instance cost daily sync started", {
    tenantId: params.tenantId ?? null,
    startDate: params.startDate,
    endDate: params.endDate,
  });

  const repository = new Ec2InstanceCostDailyRepository();
  const result = await repository.syncEc2InstanceCostDaily(params);

  logger.info("EC2 instance cost daily sync completed", {
    tenantId: params.tenantId ?? null,
    startDate: params.startDate,
    endDate: params.endDate,
    rowsUpserted: result.rowsUpserted,
    durationMs: Date.now() - startedAt,
  });

  return result;
}

