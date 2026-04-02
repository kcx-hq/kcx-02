import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { sendSuccess } from "../../utils/api-response.js";
import { OverviewService } from "./overview/overview.service.js";
import { buildDashboardRequest } from "./shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "./shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "./shared/validator.js";

const scopeResolver = new DashboardScopeResolver();
const overviewService = new OverviewService();

export async function handleGetDashboardTestTotalSpend(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);

  const scope = await scopeResolver.resolve(dashboardRequest);
  const totalSpendResult = await overviewService.getTotalSpend(scope);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Dashboard total spend loaded",
    data: {
      scope,
      totalSpend: totalSpendResult.totalSpend,
    },
  });
}

export async function handleGetDashboardScope(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);

  const scope = await scopeResolver.resolve(dashboardRequest);

  if (scope.scopeType === "upload") {
    sendSuccess({
      res,
      req,
      statusCode: HTTP_STATUS.OK,
      message: "Dashboard scope resolved",
      data: {
        ...scope,
        title: `Upload Selection (${scope.rawBillingFileIds.length} file${scope.rawBillingFileIds.length === 1 ? "" : "s"})`,
      },
    });
    return;
  }

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Dashboard scope resolved",
    data: {
      ...scope,
      providerId: scope.providerId ?? null,
      billingAccountKey: scope.billingAccountKey ?? null,
      subAccountKey: scope.subAccountKey ?? null,
      serviceKey: scope.serviceKey ?? null,
      regionKey: scope.regionKey ?? null,
      title: "All Cloud Costs",
    },
  });
}
