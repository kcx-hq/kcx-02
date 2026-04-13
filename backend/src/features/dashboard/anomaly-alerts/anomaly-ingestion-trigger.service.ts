import { QueryTypes } from "sequelize";

import { createAnomalyDetectionRun } from "./anomaly-detection-run.service.js";
import { executeAnomalyDetectionRun } from "./anomaly-execution.service.js";
import { BillingIngestionRun, BillingSource, AnomalyDetectionRun, sequelize } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";

type IngestionDateWindow = {
  dateFrom: string | null;
  dateTo: string | null;
};

const isPositiveIntegerString = (value: string): boolean => /^\d+$/.test(value);

const resolveIngestionDateWindow = async (ingestionRunId: string): Promise<IngestionDateWindow> => {
  try {
    const [windowRow] = await sequelize.query<{ date_from: string | null; date_to: string | null }>(
      `
        SELECT
          MIN(dd.full_date)::text AS date_from,
          MAX(dd.full_date)::text AS date_to
        FROM fact_cost_line_items fcli
        JOIN dim_date dd ON dd.id = fcli.usage_date_key
        WHERE fcli.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
      `,
      {
        replacements: { ingestionRunId },
        type: QueryTypes.SELECT,
      },
    );

    return {
      dateFrom: windowRow?.date_from ?? null,
      dateTo: windowRow?.date_to ?? null,
    };
  } catch (error) {
    logger.warn("Anomaly ingestion trigger: failed to resolve ingestion date window; proceeding with null range", {
      ingestionRunId,
      reason: error instanceof Error ? error.message : String(error),
    });

    return {
      dateFrom: null,
      dateTo: null,
    };
  }
};

export async function triggerAnomalyDetectionRunExecution(runId: string): Promise<void> {
  logger.info("Anomaly run execution requested", {
    runId,
  });

  await executeAnomalyDetectionRun(runId);
}

export async function createAndStartAnomalyDetectionRunFromIngestion({
  ingestionRunId,
}: {
  ingestionRunId: string | number;
}): Promise<void> {
  const normalizedIngestionRunId = String(ingestionRunId ?? "").trim();
  if (!isPositiveIntegerString(normalizedIngestionRunId)) {
    logger.warn("Anomaly ingestion trigger skipped: invalid ingestion run id", {
      ingestionRunId,
    });
    return;
  }

  const existingRun = await AnomalyDetectionRun.findOne({
    where: {
      ingestionRunId: normalizedIngestionRunId,
      triggerType: "ingestion",
    },
    order: [["createdAt", "DESC"]],
  });

  if (existingRun) {
    logger.info("Anomaly ingestion trigger skipped: run already exists", {
      ingestionRunId: normalizedIngestionRunId,
      anomalyRunId: existingRun.id,
    });

    await triggerAnomalyDetectionRunExecution(String(existingRun.id));
    return;
  }

  const ingestionRun = await BillingIngestionRun.findByPk(normalizedIngestionRunId, {
    include: [
      {
        model: BillingSource,
        required: true,
      },
    ],
  });

  if (!ingestionRun) {
    logger.warn("Anomaly ingestion trigger skipped: ingestion run not found", {
      ingestionRunId: normalizedIngestionRunId,
    });
    return;
  }

  const billingSource = (ingestionRun as unknown as { BillingSource?: InstanceType<typeof BillingSource> }).BillingSource;

  if (!billingSource?.id) {
    logger.warn("Anomaly ingestion trigger skipped: billing source missing on ingestion run", {
      ingestionRunId: normalizedIngestionRunId,
    });
    return;
  }

  const dateWindow = await resolveIngestionDateWindow(normalizedIngestionRunId);

  const run = await createAnomalyDetectionRun({
    triggerType: "ingestion",
    mode: "incremental",
    billingSourceId: String(billingSource.id),
    ingestionRunId: normalizedIngestionRunId,
    tenantId: billingSource.tenantId ?? null,
    cloudConnectionId: billingSource.cloudConnectionId ?? null,
    dateFrom: dateWindow.dateFrom,
    dateTo: dateWindow.dateTo,
    statusMessage: "Queued from successful billing ingestion",
    metadataJson: {
      source: "billing_ingestion_completion",
      phase: "phase_4",
      dateRangeResolved: Boolean(dateWindow.dateFrom && dateWindow.dateTo),
    },
  });

  logger.info("Anomaly ingestion trigger: run created", {
    ingestionRunId: normalizedIngestionRunId,
    anomalyRunId: run.id,
    billingSourceId: run.billingSourceId,
    tenantId: billingSource.tenantId ?? null,
    cloudConnectionId: billingSource.cloudConnectionId ?? null,
    dateFrom: dateWindow.dateFrom,
    dateTo: dateWindow.dateTo,
  });

  await triggerAnomalyDetectionRunExecution(run.id);
}
