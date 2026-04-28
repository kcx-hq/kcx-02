import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { BadRequestError, NotFoundError } from "../../../errors/http-errors.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { Ec2RecommendationsService } from "./ec2-recommendations.service.js";
import {
  buildEc2RecommendationsQuery,
  buildEc2RecommendationStatusPatch,
  buildEc2RefreshInput,
} from "./ec2-recommendations.schema.js";

const service = new Ec2RecommendationsService();

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
  let payload: { id: number; status: "open" | "accepted" | "ignored" | "snoozed" | "completed" };
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
    data: { id: payload.id, status: payload.status },
  });
}
