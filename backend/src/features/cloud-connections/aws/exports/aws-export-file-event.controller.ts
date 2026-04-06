import type { Request, Response } from "express";

import { sendSuccess } from "../../../../utils/api-response.js";
import { logger } from "../../../../utils/logger.js";
import { parseWithSchema } from "../../../_shared/validation/zod-validate.js";
import { ingestionOrchestrator } from "../../../billing/services/ingestion-orchestrator.service.js";
import { queueExportFileFromEvent, queueExportManifestFromEvent } from "./aws-export-ingestion.service.js";
import { awsExportFileEventCallbackSchema } from "./aws-export-file-event.schema.js";

async function triggerQueuedIngestionRun(ingestionRunId: string): Promise<void> {
  try {
    logger.info("AWS export callback: step=trigger_ingestion:start", { ingestionRunId });
    await ingestionOrchestrator.processIngestionRun(ingestionRunId);
    logger.info("AWS export callback: step=trigger_ingestion:done", { ingestionRunId });
  } catch (error) {
    logger.error("Failed to process AWS export ingestion run", {
      ingestionRunId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleAwsExportFileArrived(req: Request, res: Response): Promise<void> {
  logger.info("AWS export callback: step=validate_payload:start");
  const payload = parseWithSchema(awsExportFileEventCallbackSchema, req.body);
  logger.info("AWS export callback: step=validate_payload:done", {
    callback_token: payload.callback_token,
    trigger_type: payload.trigger_type,
  });

  logger.info("AWS export callback: step=normalize_object_key:start");
  const normalizedObjectKey = String(payload.object_key ?? "").trim();
  const isManifestObject = normalizedObjectKey.toLowerCase().endsWith("manifest.json");
  logger.info("AWS export callback: step=normalize_object_key:done", {
    normalized_object_key: normalizedObjectKey,
    is_manifest_object: isManifestObject,
  });

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

  logger.info("AWS export callback: step=queue_call:start", {
    queue_path: "queueExportManifestFromEvent",
  });
  const result = await queueExportManifestFromEvent({
    callbackToken: payload.callback_token,
    accountId: payload.account_id,
    region: payload.region,
    roleArn: payload.role_arn,
    bucketName: payload.bucket_name,
    manifestKey: normalizedObjectKey,
  });
  logger.info("AWS export callback: step=queue_call:done", {
    queued: result.queued,
    skipped: result.skipped,
    ingestionRunId: result.ingestionRunId ?? null,
    reason: result.reason ?? null,
  });

  logger.info("AWS export callback: step=send_response:start");
  sendSuccess({
    res,
    req,
    message: "AWS export file event received",
    data: result,
  });
  logger.info("AWS export callback: step=send_response:done");

  if (result.queued && result.ingestionRunId) {
    const ingestionRunId = result.ingestionRunId;
    logger.info("AWS export callback: step=schedule_ingestion:start", { ingestionRunId });
    setImmediate(() => {
      void triggerQueuedIngestionRun(ingestionRunId);
    });
    logger.info("AWS export callback: step=schedule_ingestion:done", { ingestionRunId });
  } else {
    logger.info("AWS export callback: step=schedule_ingestion:skipped", {
      queued: result.queued,
      ingestionRunId: result.ingestionRunId ?? null,
    });
  }
}
