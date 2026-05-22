import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { BadRequestError, NotFoundError } from "../../../errors/http-errors.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { Ec2RecommendationActionsService } from "./ec2-recommendation-actions.service.js";
import { Ec2RecommendationsService } from "./ec2-recommendations.service.js";
import {
  buildEc2RecommendationActionRequest,
  buildEc2RecommendationsQuery,
  buildEc2RecommendationStatusPatch,
  buildEc2RefreshInput,
} from "./ec2-recommendations.schema.js";

const service = new Ec2RecommendationsService();
const actionsService = new Ec2RecommendationActionsService();

export async function handleGetEc2Recommendations(req: Request, res: Response): Promise<void> {
  const query = buildEc2RecommendationsQuery(req);
  const data = await service.getRecommendations(query);
  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "EC2 recommendations fetched successfully",
    data,
  });
}

export async function handleRefreshEc2Recommendations(req: Request, res: Response): Promise<void> {
  const input = buildEc2RefreshInput(req);
  const data = await service.refreshRecommendations(input);
  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "EC2 recommendations refreshed successfully",
    data,
  });
}

export async function handlePatchEc2RecommendationStatus(req: Request, res: Response): Promise<void> {
  let payload: {
    id: number;
    status: "open" | "in_progress" | "snoozed" | "dismissed" | "completed";
    reason: string | null;
    snoozedUntil: string | null;
  };
  try {
    payload = buildEc2RecommendationStatusPatch(req);
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "Invalid request");
  }
  const tenantId = buildEc2RecommendationsQuery(req).tenantId;
  const updated = await service.updateStatus({ tenantId, ...payload });
  if (!updated) throw new NotFoundError("Recommendation not found");
  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Recommendation status updated successfully",
    data: {
      id: payload.id,
      status: payload.status,
      statusReason: payload.reason,
      snoozedUntil: payload.snoozedUntil,
    },
  });
}

export async function handlePostEc2RecommendationActionPrecheck(req: Request, res: Response): Promise<void> {
  let payload: ReturnType<typeof buildEc2RecommendationActionRequest>;
  try {
    payload = buildEc2RecommendationActionRequest(req);
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "Invalid request");
  }
  const tenantId = buildEc2RecommendationsQuery(req).tenantId;
  const userId = req.auth?.user?.id ? String(req.auth.user.id) : null;
  const data = await actionsService.precheck({
    tenantId,
    userId,
    recommendationId: payload.id,
    payload: {
      actionKey: payload.actionKey,
      parameters: payload.parameters,
    },
  });
  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Recommendation action precheck completed",
    data,
  });
}

export async function handlePostEc2RecommendationActionExecute(req: Request, res: Response): Promise<void> {
  let payload: ReturnType<typeof buildEc2RecommendationActionRequest>;
  try {
    payload = buildEc2RecommendationActionRequest(req);
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "Invalid request");
  }
  const tenantId = buildEc2RecommendationsQuery(req).tenantId;
  const userId = req.auth?.user?.id ? String(req.auth.user.id) : null;
  const data = await actionsService.execute({
    tenantId,
    userId,
    recommendationId: payload.id,
    payload: {
      actionKey: payload.actionKey,
      parameters: payload.parameters,
    },
  });
  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Recommendation action executed",
    data,
  });
}
