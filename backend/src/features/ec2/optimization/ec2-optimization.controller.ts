import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildEc2OptimizationRecommendationsQuery } from "./ec2-optimization.schema.js";
import { Ec2OptimizationService } from "./ec2-optimization.service.js";
import type { Ec2OptimizationRecommendationFilterType } from "./ec2-optimization.types.js";

const ec2OptimizationService = new Ec2OptimizationService();

export async function handleGetEc2OptimizationSummary(req: Request, res: Response): Promise<void> {
  const input = buildEc2OptimizationRecommendationsQuery(req);
  const data = await ec2OptimizationService.getRecommendations(input);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "EC2 optimization recommendations fetched successfully",
    data,
  });
}

export async function handleGetEc2OptimizationInstances(req: Request, res: Response): Promise<void> {
  const input = buildEc2OptimizationRecommendationsQuery(req);
  const data = await ec2OptimizationService.getRecommendations(input);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "EC2 optimization recommendations fetched successfully",
    data,
  });
}

export async function handleGetEc2OptimizationInstancesByType(
  req: Request,
  res: Response,
): Promise<void> {
  const input = buildEc2OptimizationRecommendationsQuery(req);
  const optimizationTypeRaw = typeof req.params.optimizationType === "string"
    ? req.params.optimizationType.trim().toLowerCase()
    : null;
  const normalizedType: Ec2OptimizationRecommendationFilterType | null =
    optimizationTypeRaw === "overview" ? "overview" :
      optimizationTypeRaw === "rightsizing" ? "rightsizing" :
        optimizationTypeRaw === "idle_waste" || optimizationTypeRaw === "idle-waste" ? "idle_waste" :
          optimizationTypeRaw === "coverage" ? "coverage" :
            optimizationTypeRaw === "performance_risk" || optimizationTypeRaw === "performance-risk"
              ? "performance_risk"
              : optimizationTypeRaw === "all" ? "all" :
                optimizationTypeRaw === "idle" || optimizationTypeRaw === "idle_instance"
                  ? "idle_instance"
                  : optimizationTypeRaw === "underutilized" || optimizationTypeRaw === "underutilized_instance"
                    ? "underutilized_instance"
                    : optimizationTypeRaw === "overutilized" || optimizationTypeRaw === "overutilized_instance"
                      ? "overutilized_instance"
                      : optimizationTypeRaw === "uncovered" || optimizationTypeRaw === "uncovered_on_demand"
                        ? "uncovered_on_demand"
                        : optimizationTypeRaw === "ebs_waste" ? "ebs_waste" :
                          null;

  const data = await ec2OptimizationService.getRecommendations({
    ...input,
    recommendationType: normalizedType === null ? input.recommendationType : normalizedType,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "EC2 optimization recommendations fetched successfully",
    data,
  });
}
