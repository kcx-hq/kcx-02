import { QueryTypes } from "sequelize";

import { NotFoundError } from "../../../errors/http-errors.js";
import { BudgetEvaluations, Budgets, sequelize } from "../../../models/index.js";

type BudgetScopeType = "overall" | "service" | "region" | "account";
type BudgetStatus = "active" | "inactive";
type CompareMetric = "billed-cost" | "effective-cost" | "list-cost";

export type BudgetUpsertInput = {
  budgetName: string;
  budgetAmount: number;
  periodType: "monthly";
  startMonth: string;
  endMonth: string;
  ongoing: boolean;
  scopeType: BudgetScopeType;
  scopeValue: string;
  status: BudgetStatus;
};

type BudgetScopeFilter = {
  scopeType: BudgetScopeType;
  scopeValue: string;
  status: BudgetStatus;
  threshold: number;
  compareMetric: CompareMetric;
};

type BudgetInstance = InstanceType<typeof Budgets>;

type BudgetSpendRow = {
  current_spend: number | string | null;
};

type BudgetResponseItem = {
  id: string;
  budgetName: string;
  budgetAmount: number;
  periodType: "monthly";
  startMonth: string;
  endMonth: string;
  ongoing: boolean;
  scopeType: BudgetScopeType;
  scopeValue: string;
  compareMetric: CompareMetric;
  threshold: number;
  currentSpend: number;
  status: BudgetStatus;
};

type BudgetDashboardResponse = {
  section: "budget";
  title: "Budget";
  message: string;
  items: BudgetResponseItem[];
};

const DEFAULT_THRESHOLD = 80;
const DEFAULT_COMPARE_METRIC: CompareMetric = "billed-cost";

const BUDGET_SCOPE_MAP: Record<BudgetScopeType, "global" | "service" | "account" | "tag"> = {
  overall: "global",
  service: "service",
  account: "account",
  // The schema allows "tag" but not "region". We store region budgets as tag-scoped metadata.
  region: "tag",
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toMonth = (dateOnly: string): string => dateOnly.slice(0, 7);

const normalizeScopeFilter = (raw: unknown): BudgetScopeFilter => {
  const candidate = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const scopeType = (candidate.scopeType ?? "overall") as BudgetScopeType;
  const scopeValue =
    typeof candidate.scopeValue === "string" && candidate.scopeValue.trim().length > 0
      ? candidate.scopeValue.trim()
      : "All Resources";
  const status = candidate.status === "inactive" ? "inactive" : "active";
  const thresholdRaw = Number(candidate.threshold);
  const threshold = Number.isFinite(thresholdRaw) && thresholdRaw >= 0 && thresholdRaw <= 100
    ? thresholdRaw
    : DEFAULT_THRESHOLD;
  const compareMetric = candidate.compareMetric === "effective-cost" || candidate.compareMetric === "list-cost"
    ? candidate.compareMetric
    : DEFAULT_COMPARE_METRIC;

  return {
    scopeType: scopeType === "service" || scopeType === "region" || scopeType === "account" ? scopeType : "overall",
    scopeValue,
    status,
    threshold,
    compareMetric,
  };
};

const toDateRange = (startMonth: string, endMonth: string, ongoing: boolean): { startDate: string; endDate: string | null } => {
  const [startYear, startMonthNumber] = startMonth.split("-").map((value) => Number(value));
  const startDate = `${startYear}-${String(startMonthNumber).padStart(2, "0")}-01`;

  if (ongoing) {
    return { startDate, endDate: null };
  }

  const [endYear, endMonthNumber] = endMonth.split("-").map((value) => Number(value));
  const endDate = new Date(Date.UTC(endYear, endMonthNumber, 0)).toISOString().slice(0, 10);

  return { startDate, endDate };
};

async function calculateCurrentSpend({
  tenantId,
  startDate,
  endDate,
  scope,
}: {
  tenantId: string;
  startDate: string;
  endDate: string | null;
  scope: BudgetScopeFilter;
}): Promise<number> {
  const untilDate = endDate ?? new Date().toISOString().slice(0, 10);
  const params: unknown[] = [tenantId, startDate, untilDate];
  const joins: string[] = [];
  const conditions: string[] = [
    "fcli.tenant_id = $1",
    "dd.full_date BETWEEN $2::date AND $3::date",
  ];
  const normalizedScopeValue = scope.scopeValue.trim();
  const isNumericScopeValue = /^\d+$/.test(normalizedScopeValue);

  if (scope.scopeType === "account") {
    if (isNumericScopeValue) {
      params.push(normalizedScopeValue);
      conditions.push(`fcli.sub_account_key = $${params.length}::bigint`);
    } else {
      joins.push("LEFT JOIN dim_sub_account dsa ON dsa.id = fcli.sub_account_key");
      params.push(normalizedScopeValue);
      conditions.push(`LOWER(COALESCE(dsa.sub_account_name, dsa.sub_account_id, '')) = LOWER($${params.length})`);
    }
  } else if (scope.scopeType === "service") {
    if (isNumericScopeValue) {
      params.push(normalizedScopeValue);
      conditions.push(`fcli.service_key = $${params.length}::bigint`);
    } else {
      joins.push("LEFT JOIN dim_service ds ON ds.id = fcli.service_key");
      params.push(normalizedScopeValue);
      conditions.push(`LOWER(COALESCE(ds.service_name, '')) = LOWER($${params.length})`);
    }
  } else if (scope.scopeType === "region") {
    if (isNumericScopeValue) {
      params.push(normalizedScopeValue);
      conditions.push(`fcli.region_key = $${params.length}::bigint`);
    } else {
      joins.push("LEFT JOIN dim_region dr ON dr.id = fcli.region_key");
      params.push(normalizedScopeValue);
      conditions.push(
        `(LOWER(COALESCE(dr.region_name, '')) = LOWER($${params.length}) OR LOWER(COALESCE(dr.region_id, '')) = LOWER($${params.length}))`,
      );
    }
  }

  const rows = await sequelize.query<BudgetSpendRow>(
    `
      SELECT COALESCE(SUM(fcli.billed_cost), 0)::double precision AS current_spend
      FROM fact_cost_line_items fcli
      JOIN dim_date dd ON dd.id = fcli.usage_date_key
      ${joins.join("\n")}
      WHERE ${conditions.join("\n        AND ")};
    `,
    {
      bind: params,
      type: QueryTypes.SELECT,
    },
  );

  return toNumber(rows[0]?.current_spend);
}

async function writeBudgetEvaluation({
  budgetId,
  currentSpend,
  budgetAmount,
  threshold,
}: {
  budgetId: string;
  currentSpend: number;
  budgetAmount: number;
  threshold: number;
}): Promise<void> {
  const usagePercent = budgetAmount > 0 ? (currentSpend / budgetAmount) * 100 : 0;
  const evaluationStatus = usagePercent >= 100 ? "breached" : usagePercent >= threshold ? "warning" : "ok";

  await BudgetEvaluations.create({
    budgetId,
    currentSpend: String(currentSpend),
    forecastSpend: String(currentSpend),
    thresholdPercent: String(threshold),
    status: evaluationStatus,
  });
}

async function toBudgetResponseItem(budget: BudgetInstance): Promise<BudgetResponseItem> {
  const scope = normalizeScopeFilter(budget.scopeFilter);
  const currentSpend = await calculateCurrentSpend({
    tenantId: budget.tenantId,
    startDate: budget.startDate,
    endDate: budget.endDate,
    scope,
  });

  return {
    id: budget.id,
    budgetName: budget.name,
    budgetAmount: toNumber(budget.budgetAmount),
    periodType: "monthly",
    startMonth: toMonth(budget.startDate),
    endMonth: budget.endDate ? toMonth(budget.endDate) : "",
    ongoing: budget.endDate === null,
    scopeType: scope.scopeType,
    scopeValue: scope.scopeValue,
    compareMetric: scope.compareMetric,
    threshold: scope.threshold,
    currentSpend,
    status: scope.status,
  };
}

const isConfiguredActiveBudget = (budget: BudgetInstance): boolean => normalizeScopeFilter(budget.scopeFilter).status === "active";
const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);
const isWithinActiveWindow = (budget: BudgetInstance, today: string): boolean =>
  budget.startDate <= today && (budget.endDate === null || budget.endDate >= today);

async function getMonthlyBudgetsForTenant(tenantId: string): Promise<BudgetInstance[]> {
  return Budgets.findAll({
    where: {
      tenantId,
      period: "monthly",
    },
    order: [["createdAt", "DESC"]],
  });
}

function resolveRunningBudgetId(budgets: BudgetInstance[], today: string): string | null {
  const candidates = budgets
    .filter((budget) => isConfiguredActiveBudget(budget) && isWithinActiveWindow(budget, today))
    .sort((left, right) => {
      if (left.updatedAt && right.updatedAt) {
        return right.updatedAt.getTime() - left.updatedAt.getTime();
      }
      return right.createdAt.getTime() - left.createdAt.getTime();
    });

  return candidates[0]?.id ?? null;
}

export async function getBudgetDashboardData(tenantId: string): Promise<BudgetDashboardResponse> {
  const budgets = await getMonthlyBudgetsForTenant(tenantId);
  const today = toDateOnly(new Date());
  const runningBudgetId = resolveRunningBudgetId(budgets, today);
  const baseItems = await Promise.all(budgets.map((budget) => toBudgetResponseItem(budget)));
  const items = baseItems.map((item) => {
    const status: BudgetStatus = item.id === runningBudgetId ? "active" : "inactive";
    return {
      ...item,
      status,
    };
  });

  return {
    section: "budget",
    title: "Budget",
    message: "Budget dashboard data fetched successfully",
    items,
  };
}

export async function createBudget(tenantId: string, createdBy: string | null, input: BudgetUpsertInput): Promise<BudgetResponseItem> {
  const scopeValue = "All Resources";
  const { startDate, endDate } = toDateRange(input.startMonth, input.endMonth, input.ongoing);
  const scopeFilter: BudgetScopeFilter = {
    scopeType: "overall",
    scopeValue,
    status: input.status,
    threshold: DEFAULT_THRESHOLD,
    compareMetric: DEFAULT_COMPARE_METRIC,
  };

  const created = await Budgets.create({
    tenantId,
    cloudConnectionId: null,
    name: input.budgetName.trim(),
    budgetAmount: String(input.budgetAmount),
    currency: "USD",
    period: "monthly",
    startDate,
    endDate,
    scopeType: BUDGET_SCOPE_MAP.overall,
    scopeFilter,
    createdBy,
  });

  const responseItem = await toBudgetResponseItem(created);
  await writeBudgetEvaluation({
    budgetId: created.id,
    currentSpend: responseItem.currentSpend,
    budgetAmount: responseItem.budgetAmount,
    threshold: responseItem.threshold,
  });

  return responseItem;
}

export async function updateBudget(
  tenantId: string,
  budgetId: string,
  input: BudgetUpsertInput,
): Promise<BudgetResponseItem> {
  const budget = await Budgets.findOne({
    where: {
      id: budgetId,
      tenantId,
    },
  });

  if (!budget) {
    throw new NotFoundError("Budget not found");
  }

  const scopeValue = "All Resources";
  const { startDate, endDate } = toDateRange(input.startMonth, input.endMonth, input.ongoing);
  const existingScope = normalizeScopeFilter(budget.scopeFilter);
  const scopeFilter: BudgetScopeFilter = {
    scopeType: "overall",
    scopeValue,
    status: input.status,
    threshold: existingScope.threshold,
    compareMetric: existingScope.compareMetric,
  };

  await budget.update({
    name: input.budgetName.trim(),
    budgetAmount: String(input.budgetAmount),
    period: "monthly",
    startDate,
    endDate,
    scopeType: BUDGET_SCOPE_MAP.overall,
    scopeFilter,
    updatedAt: new Date(),
  });

  const responseItem = await toBudgetResponseItem(budget);
  await writeBudgetEvaluation({
    budgetId: budget.id,
    currentSpend: responseItem.currentSpend,
    budgetAmount: responseItem.budgetAmount,
    threshold: responseItem.threshold,
  });

  return responseItem;
}

export async function updateBudgetStatus(
  tenantId: string,
  budgetId: string,
  status: BudgetStatus,
): Promise<BudgetResponseItem> {
  const budget = await Budgets.findOne({
    where: {
      id: budgetId,
      tenantId,
    },
  });

  if (!budget) {
    throw new NotFoundError("Budget not found");
  }

  const scopeFilter = normalizeScopeFilter(budget.scopeFilter);
  await budget.update({
    scopeFilter: {
      ...scopeFilter,
      status,
    },
    updatedAt: new Date(),
  });

  return toBudgetResponseItem(budget);
}
