import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildOverviewFilters } from "./overview.schema.js";
import { OverviewService } from "./overview.service.js";

const overviewService = new OverviewService();

export async function handleGetOverviewDashboard(req: Request, res: Response): Promise<void> {
  const filters = buildOverviewFilters(req);
  const data = await overviewService.getOverview(filters);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Overview dashboard loaded",
    data,
  });
}

export async function handleGetOverviewKpis(req: Request, res: Response): Promise<void> {
  const filters = buildOverviewFilters(req);
  const data = await overviewService.getKpis(filters);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Overview KPIs loaded",
    data,
  });
}

export async function handleGetOverviewBudgetVsActualForecast(req: Request, res: Response): Promise<void> {
  const filters = buildOverviewFilters(req);
  const data = await overviewService.getBudgetVsActualForecast(filters);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Budget vs actual vs forecast loaded",
    data: { items: data },
  });
}

export async function handleGetOverviewTopServices(req: Request, res: Response): Promise<void> {
  const filters = buildOverviewFilters(req);
  const data = await overviewService.getTopServices(filters);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Top services loaded",
    data: { items: data },
  });
}

export async function handleGetOverviewTopAccounts(req: Request, res: Response): Promise<void> {
  const filters = buildOverviewFilters(req);
  const data = await overviewService.getTopAccounts(filters);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Top accounts loaded",
    data: { items: data },
  });
}

export async function handleGetOverviewTopRegions(req: Request, res: Response): Promise<void> {
  const filters = buildOverviewFilters(req);
  const data = await overviewService.getTopRegions(filters);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Top regions loaded",
    data: { items: data },
  });
}

export async function handleGetOverviewSavingsInsights(req: Request, res: Response): Promise<void> {
  const filters = buildOverviewFilters(req);
  const data = await overviewService.getSavingsInsights(filters);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Savings insights loaded",
    data,
  });
}

export async function handleGetOverviewAnomalies(req: Request, res: Response): Promise<void> {
  const filters = buildOverviewFilters(req);
  const data = await overviewService.getAnomalies(filters);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Overview anomalies loaded",
    data,
  });
}

export async function handleGetOverviewRecommendations(req: Request, res: Response): Promise<void> {
  const filters = buildOverviewFilters(req);
  const data = await overviewService.getRecommendations(filters);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Overview recommendations loaded",
    data,
  });
}

export async function handleGetDashboardFilters(req: Request, res: Response): Promise<void> {
  const filters = buildOverviewFilters(req);
  const data = await overviewService.getFilterOptions(filters);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Dashboard filters loaded",
    data,
  });
}
