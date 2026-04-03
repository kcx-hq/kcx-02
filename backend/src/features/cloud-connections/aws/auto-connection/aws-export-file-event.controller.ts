import type { Request, Response } from "express";

import { sendSuccess } from "../../../../utils/api-response.js";
import { logger } from "../../../../utils/logger.js";
import { parseWithSchema } from "../../../_shared/validation/zod-validate.js";
import { ingestionOrchestrator } from "../../../billing/services/ingestion-orchestrator.service.ts";
import { queueExportFileFromEvent } from "./aws-export-ingestion.service.ts";
import { awsExportFileEventCallbackSchema } from "./cloud-connections.schema.js";

async function triggerQueuedIngestionRun(ingestionRunId: string): Promise<void> {
  try {
    await ingestionOrchestrator.processIngestionRun(ingestionRunId);
  } catch (error) {
    logger.error("Failed to process AWS export ingestion run", {
      ingestionRunId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleAwsExportFileArrived(req: Request, res: Response): Promise<void> {
  const payload = parseWithSchema(awsExportFileEventCallbackSchema, req.body);

  logger.info("AWS export file event received", {
    callback_token: payload.callback_token,
    trigger_type: payload.trigger_type,
    account_id: payload.account_id,
    region: payload.region,
    role_arn: payload.role_arn,
    bucket_name: payload.bucket_name,
    object_key: payload.object_key,
    body: payload,
  });

  const result = await queueExportFileFromEvent({
    callbackToken: payload.callback_token,
    accountId: payload.account_id,
    region: payload.region,
    roleArn: payload.role_arn,
    bucketName: payload.bucket_name,
    objectKey: payload.object_key,
  });

  sendSuccess({
    res,
    req,
    message: "AWS export file event received",
    data: result,
  });

  if (result.queued && result.ingestionRunId) {
    const ingestionRunId = result.ingestionRunId;
    setImmediate(() => {
      void triggerQueuedIngestionRun(ingestionRunId);
    });
  }
}
