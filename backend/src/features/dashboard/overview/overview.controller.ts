import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildDashboardRequest } from "../shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "../shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "../shared/validator.js";
import { OverviewService } from "./overview.service.js";

const scopeResolver = new DashboardScopeResolver();
const overviewService = new OverviewService();

export async function handleGetOverviewDashboard(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);

  const scope = await scopeResolver.resolve(dashboardRequest);
  const { totalSpend } = await overviewService.getTotalSpend(scope);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Overview total spend loaded",
    data: {
      scope,
      summary: {
        totalSpend,
      },
    },
  });
}
