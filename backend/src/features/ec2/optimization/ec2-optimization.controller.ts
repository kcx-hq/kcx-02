import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildEc2OptimizationRecommendationsQuery } from "./ec2-optimization.schema.js";
import { Ec2OptimizationService } from "./ec2-optimization.service.js";

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
  const normalizedType =
    optimizationTypeRaw === "overview" ? "overview" :
      optimizationTypeRaw === "rightsizing" ? "rightsizing" :
        optimizationTypeRaw === "idle_waste" ? "idle_waste" :
          optimizationTypeRaw === "coverage" ? "coverage" :
            optimizationTypeRaw === "performance_risk" ? "performance_risk" :
              optimizationTypeRaw === "idle-waste" ? "idle_waste" :
                optimizationTypeRaw === "performance-risk" ? "performance_risk" :
    optimizationTypeRaw === "idle" ? "idle_instance" :
      optimizationTypeRaw === "underutilized" ? "underutilized_instance" :
        optimizationTypeRaw === "overutilized" ? "overutilized_instance" :
          optimizationTypeRaw === "uncovered" ? "uncovered_on_demand" :
            optimizationTypeRaw;

  const data = await ec2OptimizationService.getRecommendations({
    ...input,
    recommendationType: normalizedType === null ? input.recommendationType : normalizedType as
      | "overview"
      | "rightsizing"
      | "idle_waste"
      | "coverage"
      | "performance_risk"
      | "all"
      | "idle_instance"
      | "underutilized_instance"
      | "overutilized_instance"
      | "uncovered_on_demand"
      | "ebs_waste",
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "EC2 optimization recommendations fetched successfully",
    data,
  });
}
