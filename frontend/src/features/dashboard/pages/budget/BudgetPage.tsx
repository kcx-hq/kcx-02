import { useMemo, useState } from "react";
import { PageSection } from "../../common/components";
import { useBudgetQuery, useDashboardFiltersQuery } from "../../hooks/useDashboardQueries";

type ScopeType = "overall" | "service" | "region" | "account";
type BudgetStatus = "active" | "inactive";
type CompareMetric = "billed-cost" | "effective-cost" | "list-cost";

type BudgetFormState = {
  budgetName: string;
  budgetAmount: string;
  periodType: "monthly";
  startMonth: string;
  endMonth: string;
  ongoing: boolean;
  scopeType: ScopeType;
  scopeValue: string;
  compareMetric: CompareMetric;
  status: BudgetStatus;
};

type BudgetRow = {
  id: string;
  budgetName: string;
  budgetAmount: number;
  periodType: "monthly";
  startMonth: string;
  endMonth: string;
  ongoing: boolean;
  scopeType: ScopeType;
  scopeValue: string;
  compareMetric: CompareMetric;
  threshold: number;
  currentSpend: number;
  status: BudgetStatus;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

function formatYearMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function toLabelCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createInitialFormState(): BudgetFormState {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    budgetName: "",
    budgetAmount: "",
    periodType: "monthly",
    startMonth: formatYearMonth(now),
    endMonth: formatYearMonth(nextMonth),
    ongoing: false,
    scopeType: "overall",
    scopeValue: "All Resources",
    compareMetric: "billed-cost",
    status: "active",
  };
}

const initialBudgets: BudgetRow[] = [
  {
    id: "bud-1",
    budgetName: "Global Monthly Guardrail",
    budgetAmount: 32000,
    periodType: "monthly",
    startMonth: "2026-04",
    endMonth: "",
    ongoing: true,
    scopeType: "overall",
    scopeValue: "All Resources",
    compareMetric: "billed-cost",
    threshold: 80,
    currentSpend: 19860,
    status: "active",
  },
  {
    id: "bud-2",
    budgetName: "Compute Services",
    budgetAmount: 18000,
    periodType: "monthly",
    startMonth: "2026-04",
    endMonth: "2026-12",
    ongoing: false,
    scopeType: "service",
    scopeValue: "EC2",
    compareMetric: "billed-cost",
    threshold: 85,
    currentSpend: 14240,
    status: "active",
  },
  {
    id: "bud-3",
    budgetName: "US-East Spend",
    budgetAmount: 9500,
    periodType: "monthly",
    startMonth: "2026-03",
    endMonth: "2026-11",
    ongoing: false,
    scopeType: "region",
    scopeValue: "us-east-1",
    compareMetric: "billed-cost",
    threshold: 75,
    currentSpend: 7425,
    status: "inactive",
  },
];

export default function BudgetPage() {
  const budgetQuery = useBudgetQuery();
  const filtersQuery = useDashboardFiltersQuery();

  const [form, setForm] = useState<BudgetFormState>(createInitialFormState);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<BudgetRow[]>(initialBudgets);

  const scopeOptions = useMemo(() => {
    if (form.scopeType === "overall") {
      return ["All Resources"];
    }

    if (form.scopeType === "service") {
      return (filtersQuery.data?.services ?? []).map((item) => item.name);
    }

    if (form.scopeType === "region") {
      return (filtersQuery.data?.regions ?? []).map((item) => item.name);
    }

    return (filtersQuery.data?.accounts ?? []).map((item) => item.name);
  }, [filtersQuery.data?.accounts, filtersQuery.data?.regions, filtersQuery.data?.services, form.scopeType]);

  const formCanSubmit =
    form.budgetName.trim().length > 0 &&
    Number(form.budgetAmount) > 0 &&
    form.startMonth.trim().length > 0 &&
    (form.ongoing || form.endMonth.trim().length > 0) &&
    form.scopeValue.trim().length > 0;

  const onReset = () => {
    setForm(createInitialFormState());
    setSelectedBudgetId(null);
  };

  const mapFormToBudget = (currentSpend: number, id: string): BudgetRow => ({
    id,
    budgetName: form.budgetName.trim(),
    budgetAmount: Number(form.budgetAmount),
    periodType: form.periodType,
    startMonth: form.startMonth,
    endMonth: form.ongoing ? "" : form.endMonth,
    ongoing: form.ongoing,
    scopeType: form.scopeType,
    scopeValue: form.scopeValue,
    compareMetric: form.compareMetric,
    threshold: 80,
    currentSpend,
    status: form.status,
  });

  const onSaveBudget = () => {
    if (!formCanSubmit) return;

    const amount = Number(form.budgetAmount);
    const newBudget = mapFormToBudget(amount * 0.35, `bud-${Date.now()}`);
    setBudgets((current) => [newBudget, ...current]);
    onReset();
  };

  const onUpdateBudget = () => {
    if (!selectedBudgetId || !formCanSubmit) return;

    setBudgets((current) =>
      current.map((item) => {
        if (item.id !== selectedBudgetId) {
          return item;
        }
        return mapFormToBudget(item.currentSpend, item.id);
      }),
    );
    onReset();
  };

  const onEditBudget = (budget: BudgetRow) => {
    setSelectedBudgetId(budget.id);
    setForm({
      budgetName: budget.budgetName,
      budgetAmount: String(budget.budgetAmount),
      periodType: budget.periodType,
      startMonth: budget.startMonth,
      endMonth: budget.endMonth,
      ongoing: budget.ongoing,
      scopeType: budget.scopeType,
      scopeValue: budget.scopeValue,
      compareMetric: budget.compareMetric,
      status: budget.status,
    });
  };

  const onToggleStatus = (budgetId: string) => {
    setBudgets((current) =>
      current.map((budget) =>
        budget.id === budgetId ? { ...budget, status: budget.status === "active" ? "inactive" : "active" } : budget,
      ),
    );
  };

  return (
    <div className="dashboard-page budget-page">
      <PageSection
        title="Budget Setup"
        description="Create and manage budget policies by scope, period, and compare metric."
        className="budget-setup-section"
      >
        {budgetQuery.isLoading ? <p className="dashboard-note">Loading budget baseline...</p> : null}
        {budgetQuery.isError ? <p className="dashboard-note">Failed to load budget baseline: {budgetQuery.error.message}</p> : null}

        <form
          className="budget-setup-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (selectedBudgetId) {
              onUpdateBudget();
            } else {
              onSaveBudget();
            }
          }}
        >
          <label className="budget-field">
            <span className="budget-field__label">Budget Name</span>
            <input
              className="budget-field__control"
              type="text"
              value={form.budgetName}
              onChange={(event) => setForm((current) => ({ ...current, budgetName: event.target.value }))}
              placeholder="e.g. Global Monthly Guardrail"
            />
          </label>

          <label className="budget-field">
            <span className="budget-field__label">Budget Amount</span>
            <input
              className="budget-field__control"
              type="number"
              min="0"
              step="0.01"
              value={form.budgetAmount}
              onChange={(event) => setForm((current) => ({ ...current, budgetAmount: event.target.value }))}
              placeholder="0.00"
            />
          </label>

          <label className="budget-field">
            <span className="budget-field__label">Period Type</span>
            <select
              className="budget-field__control"
              value={form.periodType}
              onChange={(event) =>
                setForm((current) => ({ ...current, periodType: event.target.value as BudgetFormState["periodType"] }))
              }
            >
              <option value="monthly">Monthly</option>
            </select>
          </label>

          <label className="budget-field">
            <span className="budget-field__label">Start Month</span>
            <input
              className="budget-field__control"
              type="month"
              value={form.startMonth}
              onChange={(event) => setForm((current) => ({ ...current, startMonth: event.target.value }))}
            />
          </label>

          <label className="budget-field">
            <span className="budget-field__label">End Month</span>
            <input
              className="budget-field__control"
              type="month"
              value={form.endMonth}
              disabled={form.ongoing}
              onChange={(event) => setForm((current) => ({ ...current, endMonth: event.target.value }))}
            />
          </label>

          <label className="budget-field budget-field--checkbox">
            <span className="budget-field__label">Ongoing</span>
            <span className="budget-checkbox">
              <input
                type="checkbox"
                checked={form.ongoing}
                onChange={(event) => {
                  const ongoing = event.target.checked;
                  setForm((current) => ({ ...current, ongoing, endMonth: ongoing ? "" : current.endMonth }));
                }}
              />
              <span>Run without end month</span>
            </span>
          </label>

          <label className="budget-field">
            <span className="budget-field__label">Scope Type</span>
            <select
              className="budget-field__control"
              value={form.scopeType}
              onChange={(event) => {
                const scopeType = event.target.value as ScopeType;
                const fallbackValue = scopeType === "overall" ? "All Resources" : "";
                setForm((current) => ({ ...current, scopeType, scopeValue: fallbackValue }));
              }}
            >
              <option value="overall">Overall</option>
              <option value="service">Service</option>
              <option value="region">Region</option>
              <option value="account">Account</option>
            </select>
          </label>

          <label className="budget-field">
            <span className="budget-field__label">Scope Value</span>
            <select
              className="budget-field__control"
              value={form.scopeValue}
              onChange={(event) => setForm((current) => ({ ...current, scopeValue: event.target.value }))}
              disabled={scopeOptions.length === 0}
            >
              {scopeOptions.length === 0 ? <option value="">No options available</option> : null}
              {scopeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="budget-field">
            <span className="budget-field__label">Compare Metric</span>
            <select
              className="budget-field__control"
              value={form.compareMetric}
              onChange={(event) => setForm((current) => ({ ...current, compareMetric: event.target.value as CompareMetric }))}
            >
              <option value="billed-cost">Billed Cost</option>
              <option value="effective-cost">Effective Cost</option>
              <option value="list-cost">List Cost</option>
            </select>
          </label>

          <label className="budget-field">
            <span className="budget-field__label">Status</span>
            <select
              className="budget-field__control"
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as BudgetStatus }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <div className="budget-actions">
            <button className="budget-action-button budget-action-button--primary" type="submit" disabled={!formCanSubmit}>
              Save Budget
            </button>
            <button className="budget-action-button budget-action-button--ghost" type="button" onClick={onReset}>
              Reset
            </button>
            <button
              className="budget-action-button budget-action-button--accent"
              type="button"
              disabled={!selectedBudgetId || !formCanSubmit}
              onClick={onUpdateBudget}
            >
              Update Budget
            </button>
          </div>
        </form>
      </PageSection>

      <PageSection
        title="Configured Budgets"
        description="Track allocated budget against current spend and policy threshold."
        className="budget-table-section"
      >
        <div className="budget-table-shell">
          <table className="budget-table">
            <thead>
              <tr>
                <th>Budget Name</th>
                <th>Scope Type</th>
                <th>Scope Value</th>
                <th>Period</th>
                <th>Budget Amount</th>
                <th>Current Spend</th>
                <th>Usage %</th>
                <th>Threshold</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((budget) => {
                const usagePercent = budget.budgetAmount > 0 ? budget.currentSpend / budget.budgetAmount : 0;
                const usageClass =
                  usagePercent >= 1 ? "is-over" : usagePercent >= budget.threshold / 100 ? "is-warning" : "is-safe";

                return (
                  <tr key={budget.id}>
                    <td className="budget-table__name">{budget.budgetName}</td>
                    <td>{toLabelCase(budget.scopeType)}</td>
                    <td>{budget.scopeValue}</td>
                    <td>{budget.ongoing ? `${budget.startMonth} onwards` : `${budget.startMonth} to ${budget.endMonth}`}</td>
                    <td>{currencyFormatter.format(budget.budgetAmount)}</td>
                    <td>{currencyFormatter.format(budget.currentSpend)}</td>
                    <td>
                      <div className="budget-usage">
                        <span>{percentFormatter.format(usagePercent)}</span>
                        <span className={`budget-usage__bar ${usageClass}`}>
                          <span style={{ width: `${Math.min(usagePercent * 100, 100)}%` }} />
                        </span>
                      </div>
                    </td>
                    <td>{budget.threshold}%</td>
                    <td>
                      <span className={`budget-status-pill ${budget.status === "active" ? "is-active" : "is-inactive"}`}>
                        {toLabelCase(budget.status)}
                      </span>
                    </td>
                    <td>
                      <div className="budget-table-actions">
                        <button type="button" onClick={() => onEditBudget(budget)}>
                          Edit
                        </button>
                        <button type="button" onClick={() => onToggleStatus(budget.id)}>
                          {budget.status === "active" ? "Pause" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageSection>
    </div>
  );
}
