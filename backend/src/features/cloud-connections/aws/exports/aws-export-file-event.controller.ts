import type { Request, Response } from "express";

import { BadRequestError, NotFoundError } from "../../../../errors/http-errors.js";
import { sendSuccess } from "../../../../utils/api-response.js";
import { logger } from "../../../../utils/logger.js";
import { parseWithSchema } from "../../../_shared/validation/zod-validate.js";
import { ingestionOrchestrator } from "../../../billing/services/ingestion-orchestrator.service.js";
import { registerCloudtrailObjectEvent } from "./aws-cloudtrail-file-event.service.js";
import { processPendingCloudTrailFiles } from "./aws-cloudtrail-file-processing.service.js";
import { queueExportManifestFromEvent } from "./aws-export-ingestion.service.js";
import { awsExportFileEventCallbackSchema } from "./aws-export-file-event.schema.js";

let isCloudTrailProcessingScheduledOrRunning = false;

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

function scheduleCloudTrailProcessing(): void {
  if (isCloudTrailProcessingScheduledOrRunning) {
    logger.info("CloudTrail processing already scheduled/running");
    return;
  }

  isCloudTrailProcessingScheduledOrRunning = true;
  logger.info("CloudTrail processing scheduled");

  setImmediate(() => {
    logger.info("CloudTrail processing start");
    void processPendingCloudTrailFiles({ limit: 25 })
      .then((summary) => {
        logger.info("CloudTrail processing finish", {
          pendingFound: summary.pendingFound,
          processed: summary.processed,
          failed: summary.failed,
          skipped: summary.skipped,
        });
      })
      .catch((error) => {
        logger.error("CloudTrail processing failure", {
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        isCloudTrailProcessingScheduledOrRunning = false;
      });
  });
}

export async function handleAwsFileEventArrived(
  req: Request,
  res: Response
): Promise<void> {
  logger.info("AWS file callback: step=validate_payload:start");

  const payload = parseWithSchema(awsExportFileEventCallbackSchema, req.body);

  logger.info("AWS file callback: step=validate_payload:done", {
    callback_token: payload.callback_token,
    trigger_type: payload.trigger_type,
    source_type: payload.source_type,
  });

  const normalizedObjectKey = String(payload.object_key ?? "").trim();

  const isCloudTrailEvent =
    payload.trigger_type === "cloudtrail_object_created" &&
    payload.source_type === "aws_cloudtrail";

  const isBillingManifestEvent =
    payload.trigger_type === "manifest_created" &&
    payload.source_type === "aws_data_exports_cur2";

  logger.info("AWS file callback: step=classify_event", {
    normalized_object_key: normalizedObjectKey,
    is_cloudtrail_event: isCloudTrailEvent,
    is_billing_manifest_event: isBillingManifestEvent,
  });

  logger.info("AWS file event received", {
    callback_token: payload.callback_token,
    trigger_type: payload.trigger_type,
    source_type: payload.source_type,
    schema_type: payload.schema_type,
    account_id: "account_id" in payload ? payload.account_id : null,
    region: "region" in payload ? payload.region : null,
    role_arn: "role_arn" in payload ? payload.role_arn : null,
    bucket_name: payload.bucket_name,
    object_key: payload.object_key,
  });

  type AwsFileEventResult = {
    queued: boolean;
    skipped: boolean;
    reason?: string;
    ingestionRunId?: string;
    cloudEventId?: string;
    cloudtrailSourceId?: string;
    eventKind: "billing_manifest" | "cloudtrail_object";
  };

  let result: AwsFileEventResult;

  if (!isCloudTrailEvent && !isBillingManifestEvent) {
    logger.warn("AWS file callback: unsupported payload", {
      trigger_type: payload.trigger_type,
      source_type: payload.source_type,
      schema_type: payload.schema_type,
      bucket_name: payload.bucket_name,
      object_key: payload.object_key,
    });

    sendSuccess({
      res,
      req,
      message: "AWS file event ignored",
      data: {
        queued: false,
        skipped: true,
        reason: "unsupported_event_type",
      },
    });
    return;
  }

  try {
    if (isCloudTrailEvent) {
      logger.info("AWS file callback: step=queue_call:start", {
        queue_path: "registerCloudtrailObjectEvent",
      });

      const cloudtrailResult = await registerCloudtrailObjectEvent({
        callbackToken: payload.callback_token,
        eventId: payload.event_id,
        accountId: payload.account_id,
        region: payload.region,
        roleArn: payload.role_arn,
        bucketName: payload.bucket_name,
        objectKey: normalizedObjectKey,
        sourceType: payload.source_type,
        schemaType: payload.schema_type,
        cadence: payload.cadence,
        rawPayload: payload,
      });

      result = {
        ...cloudtrailResult,
        eventKind: "cloudtrail_object",
      };
    } else {
      logger.info("AWS file callback: step=queue_call:start", {
        queue_path: "queueExportManifestFromEvent",
      });

      const billingResult = await queueExportManifestFromEvent({
        callbackToken: payload.callback_token,
        accountId: payload.account_id,
        region: payload.region,
        roleArn: payload.role_arn,
        bucketName: payload.bucket_name,
        manifestKey: normalizedObjectKey,
      });

      result = {
        ...billingResult,
        eventKind: "billing_manifest",
      };
    }
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof BadRequestError) {
      logger.warn("AWS file callback: step=queue_call:skipped", {
        reason: error.message,
        trigger_type: payload.trigger_type,
        source_type: payload.source_type,
        bucket_name: payload.bucket_name,
        object_key: normalizedObjectKey,
      });

      sendSuccess({
        res,
        req,
        message: "AWS file event ignored",
        data: {
          queued: false,
          skipped: true,
          reason: error.message,
        },
      });
      return;
    }

    throw error;
  }

  logger.info("AWS file callback: step=queue_call:done", {
    eventKind: result.eventKind,
    queued: result.queued,
    skipped: result.skipped,
    ingestionRunId: result.ingestionRunId ?? null,
    cloudEventId: result.cloudEventId ?? null,
    cloudtrailSourceId: result.cloudtrailSourceId ?? null,
    reason: result.reason ?? null,
  });

  sendSuccess({
    res,
    req,
    message: "AWS file event received",
    data: result,
  });

  if (result.eventKind === "cloudtrail_object") {
    logger.info("CloudTrail callback persisted", {
      queued: result.queued,
      cloudEventId: result.cloudEventId ?? null,
      cloudtrailSourceId: result.cloudtrailSourceId ?? null,
    });

    if (result.queued) {
      scheduleCloudTrailProcessing();
    }
  }

  if (result.eventKind === "billing_manifest" && result.queued && result.ingestionRunId) {
    const ingestionRunId = result.ingestionRunId;

    logger.info("AWS file callback: step=schedule_ingestion:start", {
      ingestionRunId,
    });

    setImmediate(() => {
      void triggerQueuedIngestionRun(ingestionRunId);
    });

    logger.info("AWS file callback: step=schedule_ingestion:done", {
      ingestionRunId,
    });
  } else {
    logger.info("AWS file callback: step=schedule_ingestion:skipped", {
      eventKind: result.eventKind,
      queued: result.queued,
      ingestionRunId: result.ingestionRunId ?? null,
    });
  }
}
