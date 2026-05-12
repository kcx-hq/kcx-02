import { logger } from "../../../../utils/logger.js";
import {
  Ec2InstanceCoverageDailyRepository,
  type SyncEc2InstanceCoverageDailyParams,
} from "./ec2-instance-coverage-daily.repository.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const validateDateOnly = (value: string, field: "startDate" | "endDate"): void => {
  if (!DATE_ONLY_REGEX.test(value)) {
    throw new Error(`${field} must be in YYYY-MM-DD format`);
  }
};

export async function syncEc2InstanceCoverageDaily(
  params: SyncEc2InstanceCoverageDailyParams,
): Promise<{ rowsUpserted: number }> {
  validateDateOnly(params.startDate, "startDate");
  validateDateOnly(params.endDate, "endDate");
  if (params.startDate > params.endDate) {
    throw new Error("startDate must be less than or equal to endDate");
  }

  const startedAt = Date.now();
  logger.info("EC2 instance coverage daily sync started", {
    tenantId: params.tenantId ?? null,
    startDate: params.startDate,
    endDate: params.endDate,
  });

  const repository = new Ec2InstanceCoverageDailyRepository();
  const result = await repository.syncEc2InstanceCoverageDaily(params);

  logger.info("EC2 instance coverage daily sync completed", {
    tenantId: params.tenantId ?? null,
    startDate: params.startDate,
    endDate: params.endDate,
    rowsUpserted: result.rowsUpserted,
    durationMs: Date.now() - startedAt,
  });

  return result;
}
