import { Bell, CalendarDays, ChevronDown, Funnel } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTenantUploadHistory } from "@/features/client-home/hooks/useTenantUploadHistory";
import { manualDashboardNavItems } from "../common/navigation";
import { useUploadDashboardFiltersQuery } from "../hooks/useUploadDashboardQueries";
import { parseUploadDashboardFiltersFromSearch } from "../utils/buildManualDashboardQueryParams";

const parseRawBillingFileIds = (value: string | null): number[] => {
  if (!value) return [];
  return [...new Set(value.split(",").map((entry) => Number(entry.trim())).filter((entry) => Number.isInteger(entry)))];
};

const setOrDelete = (params: URLSearchParams, key: string, value: string) => {
  if (value) params.set(key, value);
  else params.delete(key);
};

export function ManualDashboardGlobalHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isRangeMenuOpen, setIsRangeMenuOpen] = useState(false);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const currentFilters = useMemo(() => parseUploadDashboardFiltersFromSearch(location.search), [location.search]);

  const rawBillingFileIds = parseRawBillingFileIds(searchParams.get("rawBillingFileIds"));
  const billingStart = searchParams.get("billingPeriodStart") ?? "";
  const billingEnd = searchParams.get("billingPeriodEnd") ?? "";

  const [draftBillingStart, setDraftBillingStart] = useState(billingStart);
  const [draftBillingEnd, setDraftBillingEnd] = useState(billingEnd);
  const [draftAccount, setDraftAccount] = useState(searchParams.get("subAccountKey") ?? "");
  const [draftService, setDraftService] = useState(searchParams.get("serviceKey") ?? "");
  const [draftRegion, setDraftRegion] = useState(searchParams.get("regionKey") ?? "");

  const filtersQuery = useUploadDashboardFiltersQuery(currentFilters);
  const uploadHistoryQuery = useTenantUploadHistory(rawBillingFileIds.length > 0);

  const currentLabel = useMemo(() => {
    const match = manualDashboardNavItems.find((item) => location.pathname.startsWith(item.path));
    return match?.label ?? "Overview";
  }, [location.pathname]);

  const uploadedFileLabel = useMemo(() => {
    if (rawBillingFileIds.length === 0) return null;

    const records = uploadHistoryQuery.data ?? [];
    const firstRawFileId = rawBillingFileIds[0];
    const firstRecord = records.find((record) => Number(record.rawBillingFileId) === firstRawFileId);
    const firstFileName = firstRecord?.fileName?.trim() || "Selected upload files";

    if (rawBillingFileIds.length === 1) return firstFileName;
    return `${firstFileName} + ${rawBillingFileIds.length - 1} more`;
  }, [rawBillingFileIds, uploadHistoryQuery.data]);

  const applySearchParams = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(location.search);
    mutate(params);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const openRangeMenu = () => {
    setDraftBillingStart(billingStart);
    setDraftBillingEnd(billingEnd);
    setIsRangeMenuOpen(true);
  };

  const applyDateRange = () => {
    applySearchParams((params) => {
      setOrDelete(params, "billingPeriodStart", draftBillingStart);
      setOrDelete(params, "billingPeriodEnd", draftBillingEnd);
    });
    setIsRangeMenuOpen(false);
  };

  const openFilterPanel = () => {
    setDraftAccount(searchParams.get("subAccountKey") ?? "");
    setDraftService(searchParams.get("serviceKey") ?? "");
    setDraftRegion(searchParams.get("regionKey") ?? "");
    setIsFilterPanelOpen(true);
  };

  const applyFilters = () => {
    applySearchParams((params) => {
      setOrDelete(params, "subAccountKey", draftAccount);
      setOrDelete(params, "serviceKey", draftService);
      setOrDelete(params, "regionKey", draftRegion);
    });
    setIsFilterPanelOpen(false);
  };

  const resetFilters = () => {
    setDraftAccount("");
    setDraftService("");
    setDraftRegion("");
    applySearchParams((params) => {
      params.delete("subAccountKey");
      params.delete("serviceKey");
      params.delete("regionKey");
    });
  };

  const rangeLabel = billingStart && billingEnd ? `${billingStart} - ${billingEnd}` : "Select date range";

  return (
    <>
      <header className="dashboard-global-header">
        <nav className="dashboard-global-header__breadcrumbs" aria-label="Breadcrumb">
          <span className="dashboard-breadcrumb dashboard-breadcrumb--muted">Upload Dashboard</span>
          <span className="dashboard-breadcrumb__separator" aria-hidden="true">/</span>
          <span className="dashboard-breadcrumb dashboard-breadcrumb--current">{currentLabel}</span>
        </nav>

        <div className="dashboard-global-header__center">
          {uploadedFileLabel ? <span className="dashboard-header-file-pill">{uploadedFileLabel}</span> : null}
        </div>

        <div className="dashboard-global-header__actions">
          <div className="dashboard-date-range-picker">
            <button
              type="button"
              className={`dashboard-date-range-trigger${billingStart && billingEnd ? " is-active" : ""}${isRangeMenuOpen ? " is-open" : ""}`}
              onClick={() => (isRangeMenuOpen ? setIsRangeMenuOpen(false) : openRangeMenu())}
              aria-haspopup="dialog"
              aria-expanded={isRangeMenuOpen}
            >
              <CalendarDays className="dashboard-date-range-trigger__icon" aria-hidden="true" />
              <span className="dashboard-date-range-trigger__value">{rangeLabel}</span>
              <ChevronDown className="dashboard-date-range-trigger__caret" size={15} aria-hidden="true" />
            </button>

            {isRangeMenuOpen ? (
              <div className="dashboard-date-range-popover" role="dialog" aria-label="Select billing period">
                <div className="dashboard-date-range-popover__editor">
                  <label className="dashboard-date-range-popover__field">
                    <span>From</span>
                    <input
                      type="date"
                      className="dashboard-header-field__control"
                      min={filtersQuery.data?.billingPeriod.min ?? undefined}
                      max={filtersQuery.data?.billingPeriod.max ?? undefined}
                      value={draftBillingStart}
                      onChange={(event) => setDraftBillingStart(event.target.value)}
                    />
                  </label>

                  <label className="dashboard-date-range-popover__field">
                    <span>To</span>
                    <input
                      type="date"
                      className="dashboard-header-field__control"
                      min={filtersQuery.data?.billingPeriod.min ?? undefined}
                      max={filtersQuery.data?.billingPeriod.max ?? undefined}
                      value={draftBillingEnd}
                      onChange={(event) => setDraftBillingEnd(event.target.value)}
                    />
                  </label>

                  <div className="dashboard-date-range-popover__actions">
                    <button
                      type="button"
                      className="dashboard-date-range-popover__btn dashboard-date-range-popover__btn--ghost"
                      onClick={() => setIsRangeMenuOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="dashboard-date-range-popover__btn dashboard-date-range-popover__btn--primary"
                      onClick={applyDateRange}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="dashboard-header-action dashboard-header-action--filter"
            onClick={openFilterPanel}
            aria-haspopup="dialog"
            aria-expanded={isFilterPanelOpen}
            aria-controls="dashboard-filter-panel"
          >
            <Funnel className="dashboard-header-action__icon" aria-hidden="true" />
            <span>Filter</span>
          </button>

          <button type="button" className="dashboard-header-action dashboard-header-action--icon" aria-label="Notifications">
            <Bell className="dashboard-header-action__icon" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className={`dashboard-filter-overlay${isFilterPanelOpen ? " is-open" : ""}`} onClick={() => setIsFilterPanelOpen(false)} aria-hidden={!isFilterPanelOpen} />

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
          <button type="button" className="dashboard-filter-panel__close" onClick={() => setIsFilterPanelOpen(false)} aria-label="Close filters">
            Close
          </button>
        </div>

        <div className="dashboard-filter-panel__body">
          <label className="dashboard-filter-field">
            <span className="dashboard-filter-field__label">Account</span>
            <select className="dashboard-filter-field__control" value={draftAccount} onChange={(event) => setDraftAccount(event.target.value)}>
              <option value="">All Accounts</option>
              {(filtersQuery.data?.accounts ?? []).map((account) => (
                <option key={account.key} value={String(account.key)}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="dashboard-filter-field">
            <span className="dashboard-filter-field__label">Service</span>
            <select className="dashboard-filter-field__control" value={draftService} onChange={(event) => setDraftService(event.target.value)}>
              <option value="">All Services</option>
              {(filtersQuery.data?.services ?? []).map((service) => (
                <option key={service.key} value={String(service.key)}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>

          <label className="dashboard-filter-field">
            <span className="dashboard-filter-field__label">Region</span>
            <select className="dashboard-filter-field__control" value={draftRegion} onChange={(event) => setDraftRegion(event.target.value)}>
              <option value="">All Regions</option>
              {(filtersQuery.data?.regions ?? []).map((region) => (
                <option key={region.key} value={String(region.key)}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="dashboard-filter-panel__footer">
          <button type="button" className="dashboard-filter-panel__btn dashboard-filter-panel__btn--ghost" onClick={resetFilters}>
            Reset
          </button>
          <button type="button" className="dashboard-filter-panel__btn dashboard-filter-panel__btn--primary" onClick={applyFilters}>
            Apply
          </button>
        </div>
      </aside>
    </>
  );
}
