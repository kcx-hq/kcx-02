import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { BadRequestError } from "../../../errors/http-errors.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { resolveDashboardTenantId } from "../shared/dashboard-request-builder.js";
import {
  createBudget,
  getBudgetDashboardData,
  updateBudget,
  updateBudgetStatus,
  type BudgetUpsertInput,
} from "./budget.service.js";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requireBudgetId = (req: Request): string => {
  const budgetId = Array.isArray(req.params.budgetId) ? req.params.budgetId[0] : req.params.budgetId;
  if (!budgetId || !UUID_REGEX.test(budgetId)) {
    throw new BadRequestError("Invalid budget id");
  }
  return budgetId;
};

const parseBudgetPayload = (input: unknown): BudgetUpsertInput => {
  const payload = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  const budgetName = String(payload.budgetName ?? "").trim();
  if (budgetName.length === 0) {
    throw new BadRequestError("budgetName is required");
  }

  const budgetAmount = Number(payload.budgetAmount);
  if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
    throw new BadRequestError("budgetAmount must be a positive number");
  }

  const periodType = String(payload.periodType ?? "").trim();
  if (periodType !== "monthly") {
    throw new BadRequestError("periodType must be monthly");
  }

  const startMonth = String(payload.startMonth ?? "").trim();
  if (!MONTH_REGEX.test(startMonth)) {
    throw new BadRequestError("startMonth must be YYYY-MM");
  }

  const ongoing = Boolean(payload.ongoing);
  const endMonth = String(payload.endMonth ?? "").trim();
  if (!ongoing && !MONTH_REGEX.test(endMonth)) {
    throw new BadRequestError("endMonth must be YYYY-MM when ongoing is false");
  }

  if (!ongoing && startMonth > endMonth) {
    throw new BadRequestError("startMonth must be before or equal to endMonth");
  }

  const scopeType = "overall";
  const scopeValue = "All Resources";

  const status = String(payload.status ?? "").trim();
  if (status !== "active" && status !== "inactive") {
    throw new BadRequestError("status must be active or inactive");
  }

  return {
    budgetName,
    budgetAmount,
    periodType: "monthly",
    startMonth,
    endMonth: ongoing ? "" : endMonth,
    ongoing,
    scopeType,
    scopeValue,
    status: status as BudgetUpsertInput["status"],
  };
};

const parseStatusPayload = (input: unknown): "active" | "inactive" => {
  const payload = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const status = String(payload.status ?? "").trim();
  if (status !== "active" && status !== "inactive") {
    throw new BadRequestError("status must be active or inactive");
  }
  return status;
};

export async function handleGetBudgetDashboard(req: Request, res: Response): Promise<void> {
  const tenantId = resolveDashboardTenantId(req);
  const data = await getBudgetDashboardData(tenantId);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Budget dashboard data fetched successfully",
    data,
  });
}

export async function handleCreateBudget(req: Request, res: Response): Promise<void> {
  const tenantId = resolveDashboardTenantId(req);
  const createdBy = typeof req.auth?.user.id === "string" ? req.auth.user.id : null;
  const payload = parseBudgetPayload(req.body);

  const item = await createBudget(tenantId, createdBy, payload);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.CREATED,
    message: "Budget created",
    data: item,
  });
}

export async function handleUpdateBudget(req: Request, res: Response): Promise<void> {
  const tenantId = resolveDashboardTenantId(req);
  const budgetId = requireBudgetId(req);
  const payload = parseBudgetPayload(req.body);

  const item = await updateBudget(tenantId, budgetId, payload);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Budget updated",
    data: item,
  });
}

export async function handleUpdateBudgetStatus(req: Request, res: Response): Promise<void> {
  const tenantId = resolveDashboardTenantId(req);
  const budgetId = requireBudgetId(req);
  const status = parseStatusPayload(req.body);

  const item = await updateBudgetStatus(tenantId, budgetId, status);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Budget status updated",
    data: item,
  });
}
