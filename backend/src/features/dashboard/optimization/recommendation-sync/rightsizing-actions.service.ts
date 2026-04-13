import { QueryTypes, Transaction } from "sequelize";
import { ConflictError, NotFoundError } from "../../../../errors/http-errors.js";
import { sequelize } from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";
import { AwsEc2Error, changeInstanceType } from "../../../cloud-connections/aws/ec2/ec2.service.js";

const RIGHTSIZING_PREDICATE_SQL = `
  (
    REGEXP_REPLACE(UPPER(COALESCE(fr.category, '')), '[^A-Z]', '', 'g') = 'RIGHTSIZING'
    OR REGEXP_REPLACE(UPPER(COALESCE(fr.recommendation_type, '')), '[^A-Z]', '', 'g') = 'RIGHTSIZING'
  )
`;

type RecommendationExecutionRow = {
  id: string | number;
  tenant_id: string;
  status: string;
  resource_id: string | null;
  current_resource_type: string | null;
  recommended_resource_type: string | null;
  cloud_connection_id: string | null;
  aws_account_id: string;
  aws_region_code: string;
};

type RecommendationActionRow = {
  id: string | number;
  tenant_id: string;
  recommendation_id: string | number;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  requested_by_user_id: string | null;
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
  instance_id: string | null;
  from_instance_type: string | null;
  to_instance_type: string | null;
  cloud_connection_id: string | null;
  aws_account_id: string | null;
  aws_region_code: string | null;
  dry_run: boolean;
  error_code: string | null;
  error_message: string | null;
  details_json: unknown;
  aws_request_ids_json: unknown;
};

export type RightsizingActionExecuteResult = {
  actionId: string;
  recommendationId: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
};

export type RightsizingActionStatusResult = {
  actionId: string;
  recommendationId: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  requestedByUserId: string | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  instanceId: string | null;
  fromInstanceType: string | null;
  toInstanceType: string | null;
  cloudConnectionId: string | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
  dryRun: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  details: unknown;
  awsRequestIds: unknown;
};

const toActionStatus = (value: unknown): RecommendationActionRow["status"] => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (
    normalized === "QUEUED" ||
    normalized === "RUNNING" ||
    normalized === "SUCCEEDED" ||
    normalized === "FAILED"
  ) {
    return normalized;
  }
  return "FAILED";
};

const mapActionRow = (row: RecommendationActionRow): RightsizingActionStatusResult => ({
  actionId: String(row.id),
  recommendationId: String(row.recommendation_id),
  status: toActionStatus(row.status),
  requestedByUserId: row.requested_by_user_id ?? null,
  requestedAt: row.requested_at,
  startedAt: row.started_at ?? null,
  finishedAt: row.finished_at ?? null,
  instanceId: row.instance_id ?? null,
  fromInstanceType: row.from_instance_type ?? null,
  toInstanceType: row.to_instance_type ?? null,
  cloudConnectionId: row.cloud_connection_id ?? null,
  awsAccountId: row.aws_account_id ?? null,
  awsRegionCode: row.aws_region_code ?? null,
  dryRun: row.dry_run === true,
  errorCode: row.error_code ?? null,
  errorMessage: row.error_message ?? null,
  details: row.details_json ?? null,
  awsRequestIds: row.aws_request_ids_json ?? null,
});

const fetchRecommendationForExecution = async (input: {
  tenantId: string;
  recommendationId: string;
  transaction?: Transaction;
}): Promise<RecommendationExecutionRow | null> => {
  const rows = await sequelize.query<RecommendationExecutionRow>(
    `
      SELECT
        fr.id,
        fr.tenant_id,
        fr.status,
        fr.resource_id,
        fr.current_resource_type,
        fr.recommended_resource_type,
        fr.cloud_connection_id,
        fr.aws_account_id,
        fr.aws_region_code
      FROM fact_recommendations fr
      WHERE fr.tenant_id = $1
        AND fr.id = $2
        AND ${RIGHTSIZING_PREDICATE_SQL}
      LIMIT 1;
    `,
    {
      bind: [input.tenantId, input.recommendationId],
      type: QueryTypes.SELECT,
      transaction: input.transaction,
    },
  );
  return rows[0] ?? null;
};

export async function executeRightsizingAction({
  tenantId,
  recommendationId,
  requestedByUserId,
  dryRun = false,
  idempotencyKey,
}: {
  tenantId: string;
  recommendationId: string;
  requestedByUserId: string | null;
  dryRun?: boolean;
  idempotencyKey?: string | null;
}): Promise<RightsizingActionExecuteResult> {
  const normalizedIdempotencyKey = String(idempotencyKey ?? "").trim() || null;

  return sequelize.transaction(async (transaction) => {
    const recommendation = await fetchRecommendationForExecution({
      tenantId,
      recommendationId,
      transaction,
    });

    if (!recommendation) {
      throw new NotFoundError("Rightsizing recommendation not found");
    }

    const recommendationStatus = String(recommendation.status ?? "")
      .trim()
      .toUpperCase();
    if (recommendationStatus !== "OPEN") {
      throw new ConflictError(
        recommendationStatus === "NO_ACTION_NEEDED"
          ? "Recommendation is non-actionable and cannot be applied"
          : `Recommendation cannot be applied while in status ${recommendationStatus || "UNKNOWN"}`,
      );
    }

    const resourceId = String(recommendation.resource_id ?? "").trim();
    const currentType = String(recommendation.current_resource_type ?? "").trim() || null;
    const recommendedType = String(recommendation.recommended_resource_type ?? "").trim() || null;
    const cloudConnectionId = String(recommendation.cloud_connection_id ?? "").trim() || null;

    if (!resourceId || !recommendedType || !cloudConnectionId) {
      throw new ConflictError("Recommendation is missing required execution fields");
    }
    if (currentType && currentType === recommendedType) {
      throw new ConflictError("Recommendation has same current and recommended instance types");
    }

    const activeRows = await sequelize.query<{ id: string | number }>(
      `
        SELECT id
        FROM fact_recommendation_actions
        WHERE tenant_id = $1
          AND recommendation_id = $2
          AND action_type = 'APPLY_RIGHTSIZING'
          AND status IN ('QUEUED', 'RUNNING')
        LIMIT 1;
      `,
      {
        bind: [tenantId, recommendationId],
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    if (activeRows.length > 0) {
      throw new ConflictError("A rightsizing action is already in progress for this recommendation");
    }

    if (normalizedIdempotencyKey) {
      const existingRows = await sequelize.query<{ id: string | number; status: string }>(
        `
          SELECT id, status
          FROM fact_recommendation_actions
          WHERE tenant_id = $1
            AND recommendation_id = $2
            AND idempotency_key = $3
          LIMIT 1;
        `,
        {
          bind: [tenantId, recommendationId, normalizedIdempotencyKey],
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      if (existingRows[0]) {
        return {
          actionId: String(existingRows[0].id),
          recommendationId,
          status: toActionStatus(existingRows[0].status),
        };
      }
    }

    const insertedRows = await sequelize.query<{ id: string | number; status: string }>(
      `
        INSERT INTO fact_recommendation_actions (
          tenant_id,
          recommendation_id,
          category,
          action_type,
          status,
          requested_by_user_id,
          requested_at,
          instance_id,
          from_instance_type,
          to_instance_type,
          cloud_connection_id,
          aws_account_id,
          aws_region_code,
          dry_run,
          idempotency_key,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, 'RIGHTSIZING', 'APPLY_RIGHTSIZING', 'QUEUED', $3, NOW(),
          $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
        )
        RETURNING id, status;
      `,
      {
        bind: [
          tenantId,
          recommendationId,
          requestedByUserId,
          resourceId,
          currentType,
          recommendedType,
          cloudConnectionId,
          recommendation.aws_account_id,
          recommendation.aws_region_code,
          dryRun,
          normalizedIdempotencyKey,
        ],
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    const inserted = insertedRows[0];
    return {
      actionId: String(inserted.id),
      recommendationId,
      status: toActionStatus(inserted.status),
    };
  });
}

export async function getRightsizingActionStatus({
  tenantId,
  actionId,
}: {
  tenantId: string;
  actionId: string;
}): Promise<RightsizingActionStatusResult | null> {
  const rows = await sequelize.query<RecommendationActionRow>(
    `
      SELECT
        id,
        recommendation_id,
        status,
        requested_by_user_id,
        requested_at::text AS requested_at,
        started_at::text AS started_at,
        finished_at::text AS finished_at,
        instance_id,
        from_instance_type,
        to_instance_type,
        cloud_connection_id,
        aws_account_id,
        aws_region_code,
        dry_run,
        error_code,
        error_message,
        details_json,
        aws_request_ids_json
      FROM fact_recommendation_actions
      WHERE tenant_id = $1
        AND id = $2
        AND action_type = 'APPLY_RIGHTSIZING'
      LIMIT 1;
    `,
    {
      bind: [tenantId, actionId],
      type: QueryTypes.SELECT,
    },
  );

  if (!rows[0]) return null;
  return mapActionRow(rows[0]);
}

type ClaimedActionRow = {
  id: string | number;
  tenant_id: string;
  recommendation_id: string | number;
  dry_run: boolean;
};

const claimNextQueuedAction = async (): Promise<ClaimedActionRow | null> => {
  return sequelize.transaction(async (transaction) => {
    const rows = await sequelize.query<ClaimedActionRow>(
      `
        WITH next_action AS (
          SELECT id
          FROM fact_recommendation_actions
          WHERE status = 'QUEUED'
            AND action_type = 'APPLY_RIGHTSIZING'
          ORDER BY requested_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE fact_recommendation_actions fra
        SET status = 'RUNNING',
            started_at = NOW(),
            updated_at = NOW()
        FROM next_action
        WHERE fra.id = next_action.id
        RETURNING fra.id, fra.tenant_id, fra.recommendation_id, fra.dry_run;
      `,
      {
        type: QueryTypes.SELECT,
        transaction,
      },
    );
    return rows[0] ?? null;
  });
};

const markActionFailed = async (input: {
  actionId: string | number;
  recommendationId: string | number;
  tenantId: string;
  errorCode: string;
  errorMessage: string;
  details?: unknown;
}) => {
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `
        UPDATE fact_recommendation_actions
        SET status = 'FAILED',
            finished_at = NOW(),
            error_code = $2,
            error_message = $3,
            details_json = $4::jsonb,
            updated_at = NOW()
        WHERE id = $1;
      `,
      {
        bind: [input.actionId, input.errorCode, input.errorMessage, JSON.stringify(input.details ?? null)],
        transaction,
      },
    );

    await sequelize.query(
      `
        UPDATE fact_recommendations
        SET status = 'FAILED',
            updated_at = NOW()
        WHERE tenant_id = $1
          AND id = $2
          AND status = 'IN_PROGRESS';
      `,
      {
        bind: [input.tenantId, input.recommendationId],
        transaction,
      },
    );
  });
};

const markActionSucceeded = async (input: {
  actionId: string | number;
  recommendationId: string | number;
  tenantId: string;
  details?: unknown;
  dryRun?: boolean;
}) => {
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `
        UPDATE fact_recommendation_actions
        SET status = 'SUCCEEDED',
            finished_at = NOW(),
            details_json = $2::jsonb,
            updated_at = NOW()
        WHERE id = $1;
      `,
      {
        bind: [input.actionId, JSON.stringify(input.details ?? null)],
        transaction,
      },
    );

    if (input.dryRun) {
      await sequelize.query(
        `
          UPDATE fact_recommendations
          SET status = 'OPEN',
              updated_at = NOW()
          WHERE tenant_id = $1
            AND id = $2
            AND status = 'IN_PROGRESS';
        `,
        {
          bind: [input.tenantId, input.recommendationId],
          transaction,
        },
      );
      return;
    }

    await sequelize.query(
      `
        UPDATE fact_recommendations
        SET status = 'APPLIED',
            updated_at = NOW()
        WHERE tenant_id = $1
          AND id = $2
          AND status = 'IN_PROGRESS';
      `,
      {
        bind: [input.tenantId, input.recommendationId],
        transaction,
      },
    );
  });
};

const runClaimedAction = async (claimed: ClaimedActionRow): Promise<void> => {
  const recommendation = await fetchRecommendationForExecution({
    tenantId: claimed.tenant_id,
    recommendationId: String(claimed.recommendation_id),
  });

  if (!recommendation) {
    await markActionFailed({
      actionId: claimed.id,
      recommendationId: claimed.recommendation_id,
      tenantId: claimed.tenant_id,
      errorCode: "RECOMMENDATION_NOT_FOUND",
      errorMessage: "Associated recommendation was not found",
    });
    return;
  }

  const cloudConnectionId = String(recommendation.cloud_connection_id ?? "").trim();
  const instanceId = String(recommendation.resource_id ?? "").trim();
  const targetInstanceType = String(recommendation.recommended_resource_type ?? "").trim();
  const currentInstanceType = String(recommendation.current_resource_type ?? "").trim();

  if (
    !cloudConnectionId ||
    !instanceId ||
    !targetInstanceType ||
    (currentInstanceType && currentInstanceType === targetInstanceType)
  ) {
    await markActionFailed({
      actionId: claimed.id,
      recommendationId: claimed.recommendation_id,
      tenantId: claimed.tenant_id,
      errorCode: "RECOMMENDATION_NON_ACTIONABLE",
      errorMessage: "Recommendation is not actionable",
      details: {
        cloudConnectionId: cloudConnectionId || null,
        instanceId: instanceId || null,
        currentInstanceType: currentInstanceType || null,
        targetInstanceType: targetInstanceType || null,
      },
    });
    return;
  }

  await sequelize.query(
    `
      UPDATE fact_recommendations
      SET status = 'IN_PROGRESS',
          updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
        AND status = 'OPEN';
    `,
    {
      bind: [claimed.tenant_id, claimed.recommendation_id],
    },
  );

  try {
    if (claimed.dry_run) {
      await markActionSucceeded({
        actionId: claimed.id,
        recommendationId: claimed.recommendation_id,
        tenantId: claimed.tenant_id,
        dryRun: true,
        details: {
          dryRun: true,
          message: "Dry run completed; no EC2 changes performed",
        },
      });
      return;
    }

    const result = await changeInstanceType({
      tenantId: claimed.tenant_id,
      connectionId: cloudConnectionId,
      instanceId,
      targetInstanceType,
    });

    await markActionSucceeded({
      actionId: claimed.id,
      recommendationId: claimed.recommendation_id,
      tenantId: claimed.tenant_id,
      details: result,
      dryRun: false,
    });
  } catch (error) {
    const errorCode =
      error instanceof AwsEc2Error ? error.errorCode : "RIGHTSIZING_EXECUTION_FAILED";
    const errorMessage =
      error instanceof Error ? error.message : "Rightsizing action execution failed";
    const details =
      error instanceof AwsEc2Error ? error.details ?? null : { reason: String(error ?? "unknown") };

    await markActionFailed({
      actionId: claimed.id,
      recommendationId: claimed.recommendation_id,
      tenantId: claimed.tenant_id,
      errorCode,
      errorMessage,
      details,
    });
  }
};

let processing = false;

export async function processQueuedRightsizingActions(): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    while (true) {
      const claimed = await claimNextQueuedAction();
      if (!claimed) break;

      try {
        await runClaimedAction(claimed);
      } catch (error) {
        logger.error("Rightsizing action worker failed processing claimed action", {
          actionId: String(claimed.id),
          recommendationId: String(claimed.recommendation_id),
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    processing = false;
  }
}
