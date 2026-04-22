import { Bell, CalendarDays, Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTenantUploadHistory } from "@/features/client-home/hooks/useTenantUploadHistory";
import { dashboardNavLinks } from "../common/navigation";
import { useDashboardFiltersQuery } from "../hooks/useDashboardQueries";
import { useDashboardScope } from "../hooks/useDashboardScope";

const rootCrumb = "Dashboard";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const parseDateValue = (value: string | null): string => {
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
};

const asDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatAsQueryDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatAsDisplayDate = (value: string): string => {
  if (!value) return "--";
  const parsed = parseDateValue(value);
  if (!parsed) return "--";
  const [year, month, day] = parsed.split("-");
  return `${day}-${month}-${year}`;
};

const parseDateInput = (value: string): Date | null => {
  const parsed = parseDateValue(value);
  if (!parsed) return null;
  const date = new Date(`${parsed}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const inferGranularityFromRange = (start: string, end: string): "hourly" | "daily" | "monthly" => {
  const startDate = parseDateInput(start);
  const endDate = parseDateInput(end);
  if (!startDate || !endDate || startDate > endDate) return "daily";

  const days = Math.floor((asDay(endDate).getTime() - asDay(startDate).getTime()) / DAY_IN_MS) + 1;
  if (days <= 2) return "hourly";
  if (days >= 90) return "monthly";
  return "daily";
};

type DateRangeTab = "hourly" | "daily" | "weekly" | "monthly";

type QuickRangeOption = {
  key: string;
  label: string;
  tab: DateRangeTab;
  resolve: (today: Date) => { start: string; end: string };
};

const DATE_RANGE_TABS: Array<{ key: DateRangeTab; label: string }> = [
  { key: "hourly", label: "Hourly" },
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

const QUICK_RANGE_OPTIONS: QuickRangeOption[] = [
  {
    key: "last-24h",
    label: "Last 24 Hours",
    tab: "hourly",
    resolve: (today) => ({ start: formatAsQueryDate(today), end: formatAsQueryDate(today) }),
  },
  {
    key: "last-72h",
    label: "Last 72 Hours",
    tab: "hourly",
    resolve: (today) => ({ start: formatAsQueryDate(addDays(today, -2)), end: formatAsQueryDate(today) }),
  },
  {
    key: "last-7d",
    label: "Last 7 Days",
    tab: "daily",
    resolve: (today) => ({ start: formatAsQueryDate(addDays(today, -6)), end: formatAsQueryDate(today) }),
  },
  {
    key: "last-30d",
    label: "Last 30 Days",
    tab: "daily",
    resolve: (today) => ({ start: formatAsQueryDate(addDays(today, -29)), end: formatAsQueryDate(today) }),
  },
  {
    key: "last-90d",
    label: "Last 90 Days",
    tab: "daily",
    resolve: (today) => ({ start: formatAsQueryDate(addDays(today, -89)), end: formatAsQueryDate(today) }),
  },
  {
    key: "last-4w",
    label: "Last 4 Weeks",
    tab: "weekly",
    resolve: (today) => ({ start: formatAsQueryDate(addDays(today, -27)), end: formatAsQueryDate(today) }),
  },
  {
    key: "last-8w",
    label: "Last 8 Weeks",
    tab: "weekly",
    resolve: (today) => ({ start: formatAsQueryDate(addDays(today, -55)), end: formatAsQueryDate(today) }),
  },
  {
    key: "mtd",
    label: "Month to Date",
    tab: "monthly",
    resolve: (today) => ({ start: formatAsQueryDate(new Date(today.getFullYear(), today.getMonth(), 1)), end: formatAsQueryDate(today) }),
  },
  {
    key: "last-month",
    label: "Last Month",
    tab: "monthly",
    resolve: (today) => ({
      start: formatAsQueryDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      end: formatAsQueryDate(new Date(today.getFullYear(), today.getMonth(), 0)),
    }),
  },
  {
    key: "last-3m",
    label: "Last 3 Months",
    tab: "monthly",
    resolve: (today) => ({ start: formatAsQueryDate(new Date(today.getFullYear(), today.getMonth() - 2, 1)), end: formatAsQueryDate(today) }),
  },
  {
    key: "last-6m",
    label: "Last 6 Months",
    tab: "monthly",
    resolve: (today) => ({ start: formatAsQueryDate(new Date(today.getFullYear(), today.getMonth() - 5, 1)), end: formatAsQueryDate(today) }),
  },
  {
    key: "last-12m",
    label: "Last 12 Months",
    tab: "monthly",
    resolve: (today) => ({ start: formatAsQueryDate(new Date(today.getFullYear(), today.getMonth() - 11, 1)), end: formatAsQueryDate(today) }),
  },
  {
    key: "ytd",
    label: "Year to Date",
    tab: "monthly",
    resolve: (today) => ({ start: formatAsQueryDate(new Date(today.getFullYear(), 0, 1)), end: formatAsQueryDate(today) }),
  },
];

const detectQuickRange = (start: string, end: string): QuickRangeOption | null => {
  if (!start || !end) return null;

  const today = asDay(new Date());
  for (let offset = -2; offset <= 2; offset += 1) {
    const base = asDay(addDays(today, offset));
    const match = QUICK_RANGE_OPTIONS.find((option) => {
      const resolved = option.resolve(base);
      return resolved.start === start && resolved.end === end;
    });
    if (match) return match;
  }

  return null;
};

const inferDateRangeTab = (start: string, end: string): DateRangeTab => {
  const quickMatch = detectQuickRange(start, end);
  if (quickMatch) return quickMatch.tab;

  const granularity = inferGranularityFromRange(start, end);
  if (granularity === "hourly") return "hourly";
  if (granularity === "monthly") return "monthly";

  const startDate = parseDateInput(start);
  const endDate = parseDateInput(end);
  if (!startDate || !endDate || startDate > endDate) return "daily";

  const days = Math.floor((asDay(endDate).getTime() - asDay(startDate).getTime()) / DAY_IN_MS) + 1;
  return days >= 28 ? "weekly" : "daily";
};

export function DashboardGlobalHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { scope } = useDashboardScope();
  const [isRangeMenuOpen, setIsRangeMenuOpen] = useState(false);
  const [activeRangeTab, setActiveRangeTab] = useState<DateRangeTab>("daily");
  const [draftBillingStart, setDraftBillingStart] = useState("");
  const [draftBillingEnd, setDraftBillingEnd] = useState("");
  const [draftQuickRangeKey, setDraftQuickRangeKey] = useState<string | null>(null);
  const dateMenuRef = useRef<HTMLDivElement | null>(null);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const billingStart = parseDateValue(searchParams.get("billingPeriodStart") ?? searchParams.get("from"));
  const billingEnd = parseDateValue(searchParams.get("billingPeriodEnd") ?? searchParams.get("to"));
  const effectiveBillingStart = billingStart || (scope?.from ?? "");
  const effectiveBillingEnd = billingEnd || (scope?.to ?? "");
  const hasAppliedBillingRange = Boolean(effectiveBillingStart && effectiveBillingEnd);

  const filtersQuery = useDashboardFiltersQuery({
    ...(effectiveBillingStart ? { billingPeriodStart: effectiveBillingStart } : {}),
    ...(effectiveBillingEnd ? { billingPeriodEnd: effectiveBillingEnd } : {}),
  });
  const uploadHistoryQuery = useTenantUploadHistory(scope?.scopeType === "upload");

  const breadcrumbs = useMemo(() => {
    const path = location.pathname;

    if (path.startsWith("/dashboard/inventory/aws/ec2/instances")) {
      return [rootCrumb, "Services", "EC2", "Instances"];
    }
    if (path.startsWith("/dashboard/inventory/aws/ec2/volumes")) {
      return [rootCrumb, "Services", "EC2", "Volumes"];
    }
    if (path === "/dashboard/ec2") {
      return [rootCrumb, "Services", "EC2"];
    }
    if (path.startsWith("/dashboard/ec2/performance")) {
      return [rootCrumb, "Services", "EC2", "Performance"];
    }

    const bestMatch = dashboardNavLinks
      .filter((item) => path.startsWith(item.path))
      .sort((a, b) => b.path.length - a.path.length)[0];

    return [rootCrumb, bestMatch?.label ?? "Overview Dashboard"];
  }, [location.pathname]);

  const uploadedFileLabel = useMemo(() => {
    if (scope?.scopeType !== "upload") {
      return null;
    }

    const scopedRawFileIds = scope.rawBillingFileIds;
    const fileCount = scopedRawFileIds.length;
    const firstRawFileId = scopedRawFileIds[0];
    if (!firstRawFileId) {
      return scope.title;
    }

    const records = uploadHistoryQuery.data ?? [];
    const matching = records.find(
      (record) => Number(record.rawBillingFileId) === Number(firstRawFileId),
    );

    const firstFileName = matching?.fileName?.trim() || "Selected upload files";
    if (fileCount <= 1) {
      return firstFileName;
    }

    return `${firstFileName} + ${fileCount - 1} more`;
  }, [scope, uploadHistoryQuery.data]);

  useEffect(() => {
    if (!isRangeMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsRangeMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isRangeMenuOpen]);

  useEffect(() => {
    if (!isRangeMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!dateMenuRef.current) return;
      if (dateMenuRef.current.contains(event.target as Node)) return;
      setIsRangeMenuOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isRangeMenuOpen]);

  const updateSearchParams = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(location.search);
    mutate(params);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const setBillingRange = (start: string, end: string) => {
    const normalizedStart = parseDateValue(start);
    const normalizedEnd = parseDateValue(end);
    const startDate = normalizedStart ? parseDateInput(normalizedStart) : null;
    const endDate = normalizedEnd ? parseDateInput(normalizedEnd) : null;

    let safeStart = normalizedStart;
    let safeEnd = normalizedEnd;

    if (startDate && endDate && startDate > endDate) {
      safeStart = normalizedEnd;
      safeEnd = normalizedStart;
    }

    const granularity = safeStart && safeEnd ? inferGranularityFromRange(safeStart, safeEnd) : null;

    updateSearchParams((params) => {
      if (safeStart) {
        params.set("billingPeriodStart", safeStart);
        params.set("from", safeStart);
      } else {
        params.delete("billingPeriodStart");
        params.delete("from");
      }

      if (safeEnd) {
        params.set("billingPeriodEnd", safeEnd);
        params.set("to", safeEnd);
      } else {
        params.delete("billingPeriodEnd");
        params.delete("to");
      }

      if (granularity) {
        params.set("granularity", granularity);
      } else {
        params.delete("granularity");
      }
    });
  };

  const selectQuickRange = (key: string) => {
    const option = QUICK_RANGE_OPTIONS.find((item) => item.key === key);
    if (!option) return;

    const today = asDay(new Date());
    const resolved = option.resolve(today);
    setDraftQuickRangeKey(option.key);
    setDraftBillingStart(resolved.start);
    setDraftBillingEnd(resolved.end);
  };

  const applyDraftRange = () => {
    const startDate = parseDateInput(draftBillingStart);
    const endDate = parseDateInput(draftBillingEnd);
    if (!startDate || !endDate) return;

    setBillingRange(draftBillingStart, draftBillingEnd);
    setIsRangeMenuOpen(false);
  };

  const openRangeMenu = () => {
    const detected = detectQuickRange(effectiveBillingStart, effectiveBillingEnd);
    setDraftBillingStart(effectiveBillingStart);
    setDraftBillingEnd(effectiveBillingEnd);
    setDraftQuickRangeKey(detected?.key ?? null);
    setActiveRangeTab(detected?.tab ?? inferDateRangeTab(effectiveBillingStart, effectiveBillingEnd));
    setIsRangeMenuOpen(true);
  };

  const toggleRangeMenu = () => {
    if (isRangeMenuOpen) {
      setIsRangeMenuOpen(false);
      return;
    }
    openRangeMenu();
  };

  const activeQuickRange = useMemo(
    () => detectQuickRange(effectiveBillingStart, effectiveBillingEnd),
    [effectiveBillingEnd, effectiveBillingStart],
  );

  const rangeTriggerLabel = activeQuickRange
    ? activeQuickRange.label
    : `${formatAsDisplayDate(effectiveBillingStart)} - ${formatAsDisplayDate(effectiveBillingEnd)}`;

  const filteredQuickRanges = useMemo(
    () => QUICK_RANGE_OPTIONS.filter((option) => option.tab === activeRangeTab),
    [activeRangeTab],
  );

  const isDraftRangeValid = useMemo(() => {
    const startDate = parseDateInput(draftBillingStart);
    const endDate = parseDateInput(draftBillingEnd);
    if (!startDate || !endDate) return false;
    return startDate <= endDate;
  }, [draftBillingEnd, draftBillingStart]);

  return (
    <>
      <header className="dashboard-global-header">
        <nav className="dashboard-global-header__breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => {
            const isCurrent = index === breadcrumbs.length - 1;
            return (
              <span key={`${crumb}-${index}`}>
                {index > 0 ? (
                  <span className="dashboard-breadcrumb__separator" aria-hidden="true">
                    /
                  </span>
                ) : null}
                <span className={isCurrent ? "dashboard-breadcrumb dashboard-breadcrumb--current" : "dashboard-breadcrumb dashboard-breadcrumb--muted"}>
                  {crumb}
                </span>
              </span>
            );
          })}
        </nav>

        <div className="dashboard-global-header__center">
          {uploadedFileLabel ? <span className="dashboard-header-file-pill">{uploadedFileLabel}</span> : null}
        </div>

        <div className="dashboard-global-header__actions">
          <div className="dashboard-date-range-picker" ref={dateMenuRef}>
            <button
              type="button"
              className={`dashboard-date-range-trigger${hasAppliedBillingRange ? " is-active" : ""}${isRangeMenuOpen ? " is-open" : ""}`}
              onClick={toggleRangeMenu}
              aria-haspopup="dialog"
              aria-expanded={isRangeMenuOpen}
            >
              <CalendarDays className="dashboard-date-range-trigger__icon" aria-hidden="true" />
              <span className="dashboard-date-range-trigger__value">{rangeTriggerLabel}</span>
              <ChevronDown className="dashboard-date-range-trigger__caret" size={15} aria-hidden="true" />
            </button>

            {isRangeMenuOpen ? (
              <div className="dashboard-date-range-popover" role="dialog" aria-label="Select billing period">
                <div className="dashboard-date-range-popover__tabs" role="tablist" aria-label="Range type">
                  {DATE_RANGE_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={activeRangeTab === tab.key}
                      className={`dashboard-date-range-popover__tab${activeRangeTab === tab.key ? " is-active" : ""}`}
                      onClick={() => setActiveRangeTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="dashboard-date-range-popover__body">
                  <div className="dashboard-date-range-popover__presets" role="listbox" aria-label={`${activeRangeTab} presets`}>
                    {filteredQuickRanges.map((option) => {
                      const selected = draftQuickRangeKey === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          className={`dashboard-date-range-popover__preset${selected ? " is-active" : ""}`}
                          onClick={() => selectQuickRange(option.key)}
                          role="option"
                          aria-selected={selected}
                        >
                          <span>{option.label}</span>
                          {selected ? <Check size={14} aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                  </div>

                  <div className="dashboard-date-range-popover__editor">
                    <label className="dashboard-date-range-popover__field">
                      <span>From</span>
                      <input
                        type="date"
                        className="dashboard-header-field__control"
                        min={filtersQuery.data?.billingPeriod.min ?? undefined}
                        max={filtersQuery.data?.billingPeriod.max ?? undefined}
                        value={draftBillingStart}
                        onChange={(event) => {
                          setDraftQuickRangeKey(null);
                          setDraftBillingStart(event.target.value);
                        }}
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
                        onChange={(event) => {
                          setDraftQuickRangeKey(null);
                          setDraftBillingEnd(event.target.value);
                        }}
                      />
                    </label>

                    <p className="dashboard-date-range-popover__preview">
                      {formatAsDisplayDate(draftBillingStart)} to {formatAsDisplayDate(draftBillingEnd)}
                    </p>

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
                        onClick={applyDraftRange}
                        disabled={!isDraftRangeValid}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="dashboard-header-action dashboard-header-action--icon"
            aria-label="Notifications"
          >
            <Bell className="dashboard-header-action__icon" aria-hidden="true" />
          </button>
        </div>
      </header>
    </>
  );
}
