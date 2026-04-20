import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageSection } from "../../common/components";
import { dashboardApi, type BudgetItem, type BudgetStatus, type BudgetUpsertPayload } from "../../api/dashboardApi";
import { useBudgetQuery } from "../../hooks/useDashboardQueries";
import { useDashboardScope } from "../../hooks/useDashboardScope";

type BudgetFormState = {
  budgetName: string;
  budgetAmount: string;
  periodType: "monthly";
  startMonth: string;
  endMonth: string;
  ongoing: boolean;
  status: BudgetStatus;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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

function resolveBudgetHealth(usagePercent: number, thresholdPercent: number): {
  label: "In Budget" | "Warning" | "Over Budget";
  className: "is-safe" | "is-warning" | "is-over";
} {
  if (usagePercent >= 1) {
    return { label: "Over Budget", className: "is-over" };
  }
  if (usagePercent >= thresholdPercent / 100) {
    return { label: "Warning", className: "is-warning" };
  }
  return { label: "In Budget", className: "is-safe" };
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
    status: "active",
  };
}

export default function BudgetPage() {
  const queryClient = useQueryClient();
  const { scope } = useDashboardScope();
  const budgetQuery = useBudgetQuery();

  const [form, setForm] = useState<BudgetFormState>(createInitialFormState);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const budgets = budgetQuery.data?.items ?? [];

  const invalidateBudgetQuery = async () => {
    await queryClient.invalidateQueries({ queryKey: ["dashboard", "budget"] });
  };

  const createBudgetMutation = useMutation({
    mutationFn: async (payload: BudgetUpsertPayload) => {
      if (!scope) {
        throw new Error("Dashboard scope is not resolved yet");
      }
      return dashboardApi.createBudget(scope, payload);
    },
    onSuccess: async () => {
      await invalidateBudgetQuery();
      setCurrentPage(1);
      onReset();
      setIsBudgetModalOpen(false);
    },
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async ({ budgetId, payload }: { budgetId: string; payload: BudgetUpsertPayload }) => {
      if (!scope) {
        throw new Error("Dashboard scope is not resolved yet");
      }
      return dashboardApi.updateBudget(scope, budgetId, payload);
    },
    onSuccess: async () => {
      await invalidateBudgetQuery();
      onReset();
      setIsBudgetModalOpen(false);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ budgetId, status }: { budgetId: string; status: BudgetStatus }) => {
      if (!scope) {
        throw new Error("Dashboard scope is not resolved yet");
      }
      return dashboardApi.updateBudgetStatus(scope, budgetId, status);
    },
    onSuccess: async () => {
      await invalidateBudgetQuery();
    },
  });

  const formCanSubmit =
    form.budgetName.trim().length > 0 &&
    Number(form.budgetAmount) > 0 &&
    form.startMonth.trim().length > 0 &&
    (form.ongoing || form.endMonth.trim().length > 0);

  const validateForm = () => {
    if (form.budgetName.trim().length === 0) return "Budget name is required.";
    if (!(Number(form.budgetAmount) > 0)) return "Budget amount must be greater than 0.";
    if (form.startMonth.trim().length === 0) return "Start month is required.";
    if (!form.ongoing && form.endMonth.trim().length === 0) return "End month is required when ongoing is off.";
    return null;
  };

  const onReset = () => {
    setForm(createInitialFormState());
    setSelectedBudgetId(null);
    setFormError(null);
  };

  const buildBudgetPayload = (): BudgetUpsertPayload => ({
    budgetName: form.budgetName.trim(),
    budgetAmount: Number(form.budgetAmount),
    periodType: "monthly",
    startMonth: form.startMonth,
    endMonth: form.ongoing ? "" : form.endMonth,
    ongoing: form.ongoing,
    scopeType: "overall",
    scopeValue: "All Resources",
    status: form.status,
  });

  const onSaveBudget = async () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    await createBudgetMutation.mutateAsync(buildBudgetPayload());
  };

  const onUpdateBudget = async () => {
    if (!selectedBudgetId) return;
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    await updateBudgetMutation.mutateAsync({
      budgetId: selectedBudgetId,
      payload: buildBudgetPayload(),
    });
  };

  const onEditBudget = (budget: BudgetItem) => {
    setSelectedBudgetId(budget.id);
    setForm({
      budgetName: budget.budgetName,
      budgetAmount: String(budget.budgetAmount),
      periodType: budget.periodType,
      startMonth: budget.startMonth,
      endMonth: budget.endMonth,
      ongoing: budget.ongoing,
      status: budget.status,
    });
    setFormError(null);
    setIsBudgetModalOpen(true);
  };

  const onToggleStatus = async (budget: BudgetItem) => {
    const nextStatus: BudgetStatus = budget.status === "active" ? "inactive" : "active";
    await updateStatusMutation.mutateAsync({
      budgetId: budget.id,
      status: nextStatus,
    });
  };

  const totalRows = budgets.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startRow = totalRows > 0 ? (safePage - 1) * rowsPerPage + 1 : 0;
  const endRow = totalRows > 0 ? Math.min(safePage * rowsPerPage, totalRows) : 0;
  const visibleBudgets = budgets.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const isSubmitting =
    createBudgetMutation.isPending || updateBudgetMutation.isPending || updateStatusMutation.isPending;

  return (
    <div className="dashboard-page budget-page">
      <PageSection
        title="Budget Setup"
        description="Create and manage budgets to control cloud spend by scope, time period, and status from one place."
        actions={
          <button
            type="button"
            className="budget-action-button budget-action-button--primary"
            onClick={() => {
              onReset();
              setIsBudgetModalOpen(true);
            }}
          >
            + Create Budget
          </button>
        }
        className="budget-setup-section"
      >
        {budgetQuery.isLoading ? <p className="dashboard-note">Loading budget baseline...</p> : null}
        {budgetQuery.isError ? <p className="dashboard-note">Failed to load budget baseline: {budgetQuery.error.message}</p> : null}

        <Dialog
          open={isBudgetModalOpen}
          onOpenChange={(open) => {
            setIsBudgetModalOpen(open);
            if (!open) {
              onReset();
            }
          }}
        >
          <DialogContent className="budget-setup-dialog">
            <DialogHeader>
              <DialogTitle>{selectedBudgetId ? "Update Budget" : "Create Budget"}</DialogTitle>
            </DialogHeader>

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
              <section className="budget-form-section">
                <div className="budget-form-grid">
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
                </div>
              </section>

              <section className="budget-form-section">
                <div className="budget-form-grid">
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
                </div>
              </section>

              <section className="budget-form-section">
                <div className="budget-form-grid">
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
                </div>
              </section>

              <div className={`budget-actions${selectedBudgetId ? "" : " budget-actions--create"}`}>
                {selectedBudgetId ? (
                  <>
                    <button
                      className="budget-action-button budget-action-button--ghost"
                      type="button"
                      onClick={() => {
                        onReset();
                        setIsBudgetModalOpen(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="budget-action-button budget-action-button--primary"
                      type="submit"
                      disabled={isSubmitting}
                    >
                      Save Changes
                    </button>
                  </>
                ) : (
                  <>
                    <button className="budget-action-button budget-action-button--ghost" type="button" onClick={onReset}>
                      Clear Form
                    </button>
                    <button
                      className="budget-action-button budget-action-button--primary budget-action-button--create"
                      type="submit"
                      disabled={isSubmitting}
                    >
                      Create Budget
                    </button>
                  </>
                )}
              </div>
              {formError ? <p className="budget-form-error">{formError}</p> : null}
            </form>
          </DialogContent>
        </Dialog>
        <div className="budget-unified-divider" aria-hidden="true" />
        <div className="budget-table-shell">
          <table className="budget-table">
            <thead>
              <tr>
                <th>Budget Name</th>
                <th>Period</th>
                <th>Budget Amount</th>
                <th>Current Spend</th>
                <th>Usage %</th>
                <th>Budget Health</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleBudgets.map((budget) => {
                const usagePercent = budget.budgetAmount > 0 ? budget.currentSpend / budget.budgetAmount : 0;
                const budgetHealth = resolveBudgetHealth(usagePercent, budget.threshold);
                const usageClass = budgetHealth.className;

                return (
                  <tr key={budget.id}>
                    <td className="budget-table__name">{budget.budgetName}</td>
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
                    <td>
                      <span className={`budget-health-pill ${budgetHealth.className}`}>{budgetHealth.label}</span>
                    </td>
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
                        <button type="button" disabled={isSubmitting} onClick={() => void onToggleStatus(budget)}>
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

        <div className="budget-pagination">
          <p className="budget-pagination__meta">
            Showing {startRow}-{endRow} of {totalRows}
          </p>
          <div className="budget-pagination__actions">
            <button
              type="button"
              className="budget-pagination__btn"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              Previous
            </button>
            <span className="budget-pagination__page">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              className="budget-pagination__btn"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </PageSection>
    </div>
  );
}
