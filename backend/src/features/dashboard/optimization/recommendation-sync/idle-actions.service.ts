import { QueryTypes, Transaction } from "sequelize";
import { ConflictError, NotFoundError } from "../../../../errors/http-errors.js";
import { sequelize } from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";
import {
  AwsEc2Error,
  deleteSnapshot,
  deleteVolume,
  releaseAddress,
} from "../../../cloud-connections/aws/ec2/ec2.shared.service.js";

const IDLE_PREDICATE_SQL = `
  (
    REGEXP_REPLACE(UPPER(COALESCE(fr.category, '')), '[^A-Z]', '', 'g') = 'IDLE'
    OR REGEXP_REPLACE(UPPER(COALESCE(fr.recommendation_type, '')), '[^A-Z]', '', 'g') = 'IDLE'
  )
`;

const IDLE_ACTION_TYPES = {
  DELETE_EBS: "APPLY_IDLE_DELETE_EBS",
  RELEASE_EIP: "APPLY_IDLE_RELEASE_EIP",
  DELETE_SNAPSHOT: "APPLY_IDLE_DELETE_SNAPSHOT",
} as const;

type IdleRecommendationType = "DELETE_EBS" | "RELEASE_EIP" | "DELETE_SNAPSHOT" | "REVIEW_IDLE_LB";
type IdleActionType = (typeof IDLE_ACTION_TYPES)[keyof typeof IDLE_ACTION_TYPES];

type RecommendationExecutionRow = {
  id: string | number;
  tenant_id: string;
  status: string;
  recommendation_type: string | null;
  resource_id: string | null;
  resource_type: string | null;
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
  dry_run: boolean;
  error_code: string | null;
  error_message: string | null;
  details_json: unknown;
  aws_request_ids_json: unknown;
  resource_id: string | null;
  resource_type: string | null;
  recommendation_type: string | null;
  cloud_connection_id: string | null;
  aws_account_id: string | null;
  aws_region_code: string | null;
};

type ClaimedActionRow = {
  id: string | number;
  tenant_id: string;
  recommendation_id: string | number;
  dry_run: boolean;
};

export type IdleActionExecuteResult = {
  actionId: string;
  recommendationId: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
};

export type IdleActionStatusResult = {
  actionId: string;
  recommendationId: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  requestedByUserId: string | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  dryRun: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  details: unknown;
  awsRequestIds: unknown;
  resourceId: string | null;
  resourceType: string | null;
  recommendationType: string | null;
  cloudConnectionId: string | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
};

const toIdleRecommendationType = (value: unknown): IdleRecommendationType | null => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (
    normalized === "DELETE_EBS" ||
    normalized === "RELEASE_EIP" ||
    normalized === "DELETE_SNAPSHOT" ||
    normalized === "REVIEW_IDLE_LB"
  ) {
    return normalized;
  }
  return null;
};

const toActionType = (recommendationType: IdleRecommendationType): IdleActionType | null => {
  if (recommendationType === "DELETE_EBS") return IDLE_ACTION_TYPES.DELETE_EBS;
  if (recommendationType === "RELEASE_EIP") return IDLE_ACTION_TYPES.RELEASE_EIP;
  if (recommendationType === "DELETE_SNAPSHOT") return IDLE_ACTION_TYPES.DELETE_SNAPSHOT;
  return null;
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

const mapActionRow = (row: RecommendationActionRow): IdleActionStatusResult => ({
  actionId: String(row.id),
  recommendationId: String(row.recommendation_id),
  status: toActionStatus(row.status),
  requestedByUserId: row.requested_by_user_id ?? null,
  requestedAt: row.requested_at,
  startedAt: row.started_at ?? null,
  finishedAt: row.finished_at ?? null,
  dryRun: row.dry_run === true,
  errorCode: row.error_code ?? null,
  errorMessage: row.error_message ?? null,
  details: row.details_json ?? null,
  awsRequestIds: row.aws_request_ids_json ?? null,
  resourceId: row.resource_id ?? null,
  resourceType: row.resource_type ?? null,
  recommendationType: row.recommendation_type ?? null,
  cloudConnectionId: row.cloud_connection_id ?? null,
  awsAccountId: row.aws_account_id ?? null,
  awsRegionCode: row.aws_region_code ?? null,
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
        fr.recommendation_type,
        fr.resource_id,
        fr.resource_type,
        fr.cloud_connection_id,
        fr.aws_account_id,
        fr.aws_region_code
      FROM fact_recommendations fr
      WHERE fr.tenant_id = $1
        AND fr.id = $2
        AND ${IDLE_PREDICATE_SQL}
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

export async function executeIdleAction({
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
}): Promise<IdleActionExecuteResult> {
  const normalizedIdempotencyKey = String(idempotencyKey ?? "").trim() || null;

  return sequelize.transaction(async (transaction) => {
    const recommendation = await fetchRecommendationForExecution({
      tenantId,
      recommendationId,
      transaction,
    });

    if (!recommendation) {
      throw new NotFoundError("Idle recommendation not found");
    }

    const recommendationStatus = String(recommendation.status ?? "")
      .trim()
      .toUpperCase();
    if (recommendationStatus !== "OPEN" && recommendationStatus !== "FAILED") {
      throw new ConflictError(
        `Recommendation cannot be applied while in status ${recommendationStatus || "UNKNOWN"}`,
      );
    }

    const recommendationType = toIdleRecommendationType(recommendation.recommendation_type);
    const actionType = recommendationType ? toActionType(recommendationType) : null;
    if (!recommendationType || !actionType) {
      throw new ConflictError("Recommendation type is non-actionable for automatic execution");
    }

    const resourceId = String(recommendation.resource_id ?? "").trim();
    const cloudConnectionId = String(recommendation.cloud_connection_id ?? "").trim() || null;
    if (!resourceId || !cloudConnectionId) {
      throw new ConflictError("Recommendation is missing required execution fields");
    }

    const activeRows = await sequelize.query<{ id: string | number }>(
      `
        SELECT id
        FROM fact_recommendation_actions
        WHERE tenant_id = $1
          AND recommendation_id = $2
          AND status IN ('QUEUED', 'RUNNING')
          AND action_type IN ('APPLY_IDLE_DELETE_EBS', 'APPLY_IDLE_RELEASE_EIP', 'APPLY_IDLE_DELETE_SNAPSHOT')
        LIMIT 1;
      `,
      {
        bind: [tenantId, recommendationId],
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    if (activeRows.length > 0) {
      throw new ConflictError("An idle action is already in progress for this recommendation");
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
          recommendation_type,
          status,
          requested_by_user_id,
          requested_at,
          resource_id,
          resource_type,
          cloud_connection_id,
          aws_account_id,
          aws_region_code,
          dry_run,
          idempotency_key,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, 'IDLE', $3, $4, 'QUEUED', $5, NOW(),
          $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
        )
        RETURNING id, status;
      `,
      {
        bind: [
          tenantId,
          recommendationId,
          actionType,
          recommendationType,
          requestedByUserId,
          resourceId,
          recommendation.resource_type,
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

export async function getIdleActionStatus({
  tenantId,
  actionId,
}: {
  tenantId: string;
  actionId: string;
}): Promise<IdleActionStatusResult | null> {
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
        dry_run,
        error_code,
        error_message,
        details_json,
        aws_request_ids_json,
        resource_id,
        resource_type,
        recommendation_type,
        cloud_connection_id,
        aws_account_id,
        aws_region_code
      FROM fact_recommendation_actions
      WHERE tenant_id = $1
        AND id = $2
        AND action_type IN ('APPLY_IDLE_DELETE_EBS', 'APPLY_IDLE_RELEASE_EIP', 'APPLY_IDLE_DELETE_SNAPSHOT')
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

const claimNextQueuedAction = async (): Promise<ClaimedActionRow | null> => {
  return sequelize.transaction(async (transaction) => {
    const rows = await sequelize.query<ClaimedActionRow>(
      `
        WITH next_action AS (
          SELECT id
          FROM fact_recommendation_actions
          WHERE status = 'QUEUED'
            AND action_type IN ('APPLY_IDLE_DELETE_EBS', 'APPLY_IDLE_RELEASE_EIP', 'APPLY_IDLE_DELETE_SNAPSHOT')
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

  const recommendationType = toIdleRecommendationType(recommendation.recommendation_type);
  const resourceId = String(recommendation.resource_id ?? "").trim();
  const cloudConnectionId = String(recommendation.cloud_connection_id ?? "").trim();

  if (!recommendationType || !resourceId || !cloudConnectionId) {
    await markActionFailed({
      actionId: claimed.id,
      recommendationId: claimed.recommendation_id,
      tenantId: claimed.tenant_id,
      errorCode: "RECOMMENDATION_NON_ACTIONABLE",
      errorMessage: "Recommendation is not actionable",
      details: {
        recommendationType: recommendation.recommendation_type ?? null,
        resourceId: resourceId || null,
        cloudConnectionId: cloudConnectionId || null,
      },
    });
    return;
  }

  if (!toActionType(recommendationType)) {
    await markActionFailed({
      actionId: claimed.id,
      recommendationId: claimed.recommendation_id,
      tenantId: claimed.tenant_id,
      errorCode: "NON_ACTIONABLE_RECOMMENDATION_TYPE",
      errorMessage: "Recommendation type is non-actionable for automatic execution",
      details: {
        recommendationType,
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
        AND status IN ('OPEN', 'FAILED');
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
          message: "Dry run completed; no AWS changes performed",
        },
      });
      return;
    }

    const result =
      recommendationType === "DELETE_EBS"
        ? await deleteVolume({
            tenantId: claimed.tenant_id,
            connectionId: cloudConnectionId,
            volumeId: resourceId,
          })
        : recommendationType === "RELEASE_EIP"
          ? await releaseAddress({
              tenantId: claimed.tenant_id,
              connectionId: cloudConnectionId,
              resourceId,
            })
          : await deleteSnapshot({
              tenantId: claimed.tenant_id,
              connectionId: cloudConnectionId,
              snapshotId: resourceId,
            });

    await markActionSucceeded({
      actionId: claimed.id,
      recommendationId: claimed.recommendation_id,
      tenantId: claimed.tenant_id,
      details: result,
      dryRun: false,
    });
  } catch (error) {
    const errorCode = error instanceof AwsEc2Error ? error.errorCode : "IDLE_EXECUTION_FAILED";
    const errorMessage = error instanceof Error ? error.message : "Idle action execution failed";
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

export async function processQueuedIdleActions(): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    while (true) {
      const claimed = await claimNextQueuedAction();
      if (!claimed) break;

      try {
        await runClaimedAction(claimed);
      } catch (error) {
        logger.error("Idle action worker failed processing claimed action", {
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

