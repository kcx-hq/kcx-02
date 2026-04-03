import { Bell, Funnel } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTenantUploadHistory } from "@/features/client-home/hooks/useTenantUploadHistory";
import { dashboardNavItems } from "../common/navigation";
import { useDashboardFiltersQuery } from "../hooks/useDashboardQueries";
import { useDashboardScope } from "../hooks/useDashboardScope";

const rootCrumb = "Dashboard";

const parseDateValue = (value: string | null): string => {
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
};

export function DashboardGlobalHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { scope } = useDashboardScope();
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [draftAccount, setDraftAccount] = useState("");
  const [draftService, setDraftService] = useState("");
  const [draftRegion, setDraftRegion] = useState("");

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const billingStart = parseDateValue(searchParams.get("billingPeriodStart") ?? searchParams.get("from"));
  const billingEnd = parseDateValue(searchParams.get("billingPeriodEnd") ?? searchParams.get("to"));
  const effectiveBillingStart = billingStart || (scope?.from ?? "");
  const effectiveBillingEnd = billingEnd || (scope?.to ?? "");
  const selectedAccount = searchParams.get("subAccountKey") ?? "";
  const selectedService = searchParams.get("serviceKey") ?? "";
  const selectedRegion = searchParams.get("regionKey") ?? "";

  const filtersQuery = useDashboardFiltersQuery({
    ...(effectiveBillingStart ? { billingPeriodStart: effectiveBillingStart } : {}),
    ...(effectiveBillingEnd ? { billingPeriodEnd: effectiveBillingEnd } : {}),
  });
  const uploadHistoryQuery = useTenantUploadHistory(scope?.scopeType === "upload");

  const currentLabel = useMemo(() => {
    const match = dashboardNavItems.find((item) => location.pathname.startsWith(item.path));
    return match?.label ?? "Overview";
  }, [location.pathname]);

  const uploadedFileName = useMemo(() => {
    if (scope?.scopeType !== "upload") {
      return null;
    }

    const firstRawFileId = scope.rawBillingFileIds[0];
    if (!firstRawFileId) {
      return scope.title;
    }

    const matching = (uploadHistoryQuery.data ?? []).find(
      (record) => Number(record.rawBillingFileId) === Number(firstRawFileId),
    );
    return matching?.fileName ?? scope.title;
  }, [scope, uploadHistoryQuery.data]);

  useEffect(() => {
    if (!isFilterPanelOpen) return;
    setDraftAccount(selectedAccount);
    setDraftService(selectedService);
    setDraftRegion(selectedRegion);
  }, [isFilterPanelOpen, selectedAccount, selectedRegion, selectedService]);

  useEffect(() => {
    if (!isFilterPanelOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFilterPanelOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFilterPanelOpen]);

  const updateSearchParams = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(location.search);
    mutate(params);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const setBillingDate = (kind: "start" | "end", value: string) => {
    updateSearchParams((params) => {
      if (kind === "start") {
        if (value) {
          params.set("billingPeriodStart", value);
          params.set("from", value);
        } else {
          params.delete("billingPeriodStart");
          params.delete("from");
        }
        return;
      }

      if (value) {
        params.set("billingPeriodEnd", value);
        params.set("to", value);
      } else {
        params.delete("billingPeriodEnd");
        params.delete("to");
      }
    });
  };

  const applyPanelFilters = () => {
    updateSearchParams((params) => {
      if (draftAccount) params.set("subAccountKey", draftAccount);
      else params.delete("subAccountKey");

      if (draftService) params.set("serviceKey", draftService);
      else params.delete("serviceKey");

      if (draftRegion) params.set("regionKey", draftRegion);
      else params.delete("regionKey");
    });

    setIsFilterPanelOpen(false);
  };

  const resetPanelFilters = () => {
    setDraftAccount("");
    setDraftService("");
    setDraftRegion("");
    updateSearchParams((params) => {
      params.delete("subAccountKey");
      params.delete("serviceKey");
      params.delete("regionKey");
    });
  };

  return (
    <>
      <header className="dashboard-global-header">
        <nav className="dashboard-global-header__breadcrumbs" aria-label="Breadcrumb">
          <span className="dashboard-breadcrumb dashboard-breadcrumb--muted">{rootCrumb}</span>
          <span className="dashboard-breadcrumb__separator" aria-hidden="true">
            /
          </span>
          <span className="dashboard-breadcrumb dashboard-breadcrumb--current">{currentLabel}</span>
        </nav>

        <div className="dashboard-global-header__center">
          {uploadedFileName ? <span className="dashboard-header-file-pill">{uploadedFileName}</span> : null}
        </div>

        <div className="dashboard-global-header__actions">
          <div className="dashboard-header-range">
            <span className="dashboard-header-range__label">Billing Period</span>
            <div className="dashboard-header-range__controls">
              <input
                type="date"
                className="dashboard-header-field__control"
                min={filtersQuery.data?.billingPeriod.min ?? undefined}
                max={filtersQuery.data?.billingPeriod.max ?? undefined}
                value={effectiveBillingStart}
                onChange={(event) => setBillingDate("start", event.target.value)}
              />
              <span className="dashboard-header-range__separator">to</span>
              <input
                type="date"
                className="dashboard-header-field__control"
                min={filtersQuery.data?.billingPeriod.min ?? undefined}
                max={filtersQuery.data?.billingPeriod.max ?? undefined}
                value={effectiveBillingEnd}
                onChange={(event) => setBillingDate("end", event.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className="dashboard-header-action dashboard-header-action--filter"
            onClick={() => setIsFilterPanelOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isFilterPanelOpen}
            aria-controls="dashboard-filter-panel"
          >
            <Funnel className="dashboard-header-action__icon" aria-hidden="true" />
            <span>Filter</span>
          </button>
          <button
            type="button"
            className="dashboard-header-action dashboard-header-action--icon"
            aria-label="Notifications"
          >
            <Bell className="dashboard-header-action__icon" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        className={`dashboard-filter-overlay${isFilterPanelOpen ? " is-open" : ""}`}
        onClick={() => setIsFilterPanelOpen(false)}
        aria-hidden={!isFilterPanelOpen}
      />

      <aside
        id="dashboard-filter-panel"
        className={`dashboard-filter-panel${isFilterPanelOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard filters"
      >
        <div className="dashboard-filter-panel__header">
          <div>
            <h2 className="dashboard-filter-panel__title">Filters</h2>
            <p className="dashboard-filter-panel__subtitle">Refine the current dashboard view</p>
          </div>
          <button
            type="button"
            className="dashboard-filter-panel__close"
            onClick={() => setIsFilterPanelOpen(false)}
            aria-label="Close filters"
          >
            Close
          </button>
        </div>

        <div className="dashboard-filter-panel__body">
          <label className="dashboard-filter-field">
            <span className="dashboard-filter-field__label">Account</span>
            <select
              className="dashboard-filter-field__control"
              value={draftAccount}
              onChange={(event) => setDraftAccount(event.target.value)}
            >
              <option value="">All Accounts</option>
              {(filtersQuery.data?.accounts ?? []).map((account) => (
                <option key={account.key} value={account.key}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="dashboard-filter-field">
            <span className="dashboard-filter-field__label">Service</span>
            <select
              className="dashboard-filter-field__control"
              value={draftService}
              onChange={(event) => setDraftService(event.target.value)}
            >
              <option value="">All Services</option>
              {(filtersQuery.data?.services ?? []).map((service) => (
                <option key={service.key} value={service.key}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>

          <label className="dashboard-filter-field">
            <span className="dashboard-filter-field__label">Region</span>
            <select
              className="dashboard-filter-field__control"
              value={draftRegion}
              onChange={(event) => setDraftRegion(event.target.value)}
            >
              <option value="">All Regions</option>
              {(filtersQuery.data?.regions ?? []).map((region) => (
                <option key={region.key} value={region.key}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="dashboard-filter-panel__footer">
          <button
            type="button"
            className="dashboard-filter-panel__btn dashboard-filter-panel__btn--ghost"
            onClick={resetPanelFilters}
          >
            Reset
          </button>
          <button
            type="button"
            className="dashboard-filter-panel__btn dashboard-filter-panel__btn--primary"
            onClick={applyPanelFilters}
          >
            Apply
          </button>
        </div>
      </aside>
    </>
  );
}
