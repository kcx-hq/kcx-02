import { useEffect, useMemo, useRef, useState } from "react";

import { useCostExplorerGroupOptionsQuery } from "../../../hooks/useDashboardQueries";
import { useDashboardScope } from "../../../hooks/useDashboardScope";
import { CostExplorerFiltersPanel } from "../../cost-explorer/components";
import { parseInputDate } from "../../cost-explorer/costExplorer.utils";
import {
  COMPARE_OPTIONS,
  GROUP_BY_OPTIONS,
  METRIC_OPTIONS,
  type CompareKey,
  type CostExplorerChip,
  type Granularity,
  type GroupBy,
  type Metric,
} from "../../cost-explorer/costExplorer.types";

const haveSameStringItems = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
};

export default function CostHistoryPage() {
  const { scope } = useDashboardScope();

  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [draftGroupBy, setDraftGroupBy] = useState<GroupBy>("none");
  const [appliedGroupBy, setAppliedGroupBy] = useState<GroupBy>("none");
  const [selectedMetrics, setSelectedMetrics] = useState<Metric[]>(["billed"]);
  const [compare, setCompare] = useState<CompareKey[]>([]);
  const [draftGroupValues, setDraftGroupValues] = useState<string[]>([]);
  const [appliedGroupValues, setAppliedGroupValues] = useState<string[]>([]);
  const draftTagKey = draftGroupBy.startsWith("tag:") ? draftGroupBy.slice(4) : null;
  const groupOptionsQuery = useCostExplorerGroupOptionsQuery(draftGroupBy, draftTagKey);

  const granularityRef = useRef<HTMLButtonElement | null>(null);
  const groupRef = useRef<HTMLButtonElement | null>(null);
  const compareRef = useRef<HTMLButtonElement | null>(null);
  const metricRef = useRef<HTMLButtonElement | null>(null);

  const multiMetricMode = selectedMetrics.length > 1;
  const activeGroupBy: GroupBy = multiMetricMode ? "none" : appliedGroupBy;
  const activeGroupValues = activeGroupBy !== "none" ? appliedGroupValues : [];

  const scopeFrom = scope?.from ? parseInputDate(scope.from) : null;
  const scopeTo = scope?.to ? parseInputDate(scope.to) : null;
  const days = useMemo(() => {
    if (!scopeFrom || !scopeTo || scopeFrom > scopeTo) return 0;
    return Math.floor((scopeTo.getTime() - scopeFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [scopeFrom, scopeTo]);

  const effectiveGranularity = (granularity === "hourly" && days > 14 ? "daily" : granularity) as Granularity;

  const dynamicGroupOptions = useMemo<Array<{ key: GroupBy; label: string }>>(() => {
    const base = GROUP_BY_OPTIONS.map((item) => ({ key: item.key as GroupBy, label: item.label }));
    const noneOption = base.find((item) => item.key === "none") ?? { key: "none" as GroupBy, label: "None" };
    const baseWithoutNone = base.filter((item) => item.key !== "none");
    const tags =
      groupOptionsQuery.data?.tagKeyOptions.map((option) => ({
        key: option.key as GroupBy,
        label:
          option.normalizedKey.length > 0
            ? option.normalizedKey[0].toUpperCase() + option.normalizedKey.slice(1)
            : option.normalizedKey,
      })) ?? [];
    return [noneOption, ...tags, ...baseWithoutNone];
  }, [groupOptionsQuery.data?.tagKeyOptions]);

  useEffect(() => {
    const allowed = new Set((groupOptionsQuery.data?.groupValueOptions ?? []).map((option) => option.key));
    setDraftGroupValues((current) => current.filter((value) => allowed.has(value)));
  }, [draftGroupBy, groupOptionsQuery.data?.groupValueOptions]);

  const chips: CostExplorerChip[] = useMemo(
    () => [
      {
        key: "granularity",
        label: "Granularity",
        value: effectiveGranularity[0].toUpperCase() + effectiveGranularity.slice(1),
      },
      {
        key: "group",
        label: "Group",
        value:
          activeGroupBy !== "none" && activeGroupValues.length > 0
            ? `${dynamicGroupOptions.find((item) => item.key === activeGroupBy)?.label ?? "None"} (${activeGroupValues.length})`
            : (dynamicGroupOptions.find((item) => item.key === activeGroupBy)?.label ?? "None"),
      },
      {
        key: "compare",
        label: "Compare",
        value: compare.length
          ? compare.map((key) => COMPARE_OPTIONS.find((item) => item.key === key)?.label ?? key).join(" + ")
          : "None",
      },
      {
        key: "metric",
        label: "Metric",
        value: selectedMetrics
          .map((key) => METRIC_OPTIONS.find((item) => item.key === key)?.label ?? key)
          .join(" VS "),
      },
    ],
    [activeGroupBy, activeGroupValues.length, compare, dynamicGroupOptions, effectiveGranularity, selectedMetrics],
  );

  const normalizedDraftGroupBy: GroupBy = multiMetricMode ? "none" : draftGroupBy;
  const normalizedDraftGroupValues = normalizedDraftGroupBy === "none" ? [] : draftGroupValues;
  const hasPendingGroupChanges =
    normalizedDraftGroupBy !== activeGroupBy || !haveSameStringItems(normalizedDraftGroupValues, activeGroupValues);
  const groupValuesLoading = groupOptionsQuery.isFetching && normalizedDraftGroupBy !== "none";

  const clearAll = () => {
    setGranularity("daily");
    setDraftGroupBy("none");
    setAppliedGroupBy("none");
    setSelectedMetrics(["billed"]);
    setCompare([]);
    setDraftGroupValues([]);
    setAppliedGroupValues([]);
  };

  const toggleMetric = (metric: Metric) => {
    setSelectedMetrics((current) => {
      if (current.includes(metric)) {
        return current.length === 1 ? current : current.filter((item) => item !== metric);
      }
      const updated = [...current, metric];
      if (updated.length > 1) {
        setDraftGroupBy("none");
        setAppliedGroupBy("none");
        setDraftGroupValues([]);
        setAppliedGroupValues([]);
        setCompare([]);
      }
      return updated;
    });
  };

  const toggleCompare = (key: CompareKey) => {
    setCompare((current) => (current[0] === key ? [] : [key]));
  };

  const setGroupByWithMetricMode = (next: GroupBy) => {
    if (multiMetricMode && next !== "none") {
      setSelectedMetrics([selectedMetrics[0] ?? "billed"]);
    }
    if (next !== draftGroupBy) {
      setDraftGroupValues([]);
    }
    setDraftGroupBy(next);
  };

  const applyGroupFilters = () => {
    const normalizedGroupBy: GroupBy = multiMetricMode ? "none" : draftGroupBy;
    const normalizedGroupValues = normalizedGroupBy === "none" ? [] : draftGroupValues;
    setAppliedGroupBy(normalizedGroupBy);
    setAppliedGroupValues(normalizedGroupValues);
  };

  const editChip = (key: CostExplorerChip["key"]) => {
    if (key === "granularity") {
      granularityRef.current?.focus();
      return;
    }
    if (key === "group") {
      groupRef.current?.focus();
      return;
    }
    if (key === "compare") {
      compareRef.current?.focus();
      return;
    }
    metricRef.current?.focus();
  };

  const removeChip = (key: CostExplorerChip["key"]) => {
    if (key === "granularity") {
      setGranularity("daily");
      return;
    }
    if (key === "group") {
      setDraftGroupBy("none");
      setAppliedGroupBy("none");
      setDraftGroupValues([]);
      setAppliedGroupValues([]);
      return;
    }
    if (key === "compare") {
      setCompare([]);
      return;
    }
    setSelectedMetrics(["billed"]);
  };

  return (
    <div className="dashboard-page cost-history-page">
      <section className="cost-explorer-unified-shell">
        <CostExplorerFiltersPanel
          effectiveGranularity={effectiveGranularity}
          days={days}
          groupBy={draftGroupBy}
          selectedMetrics={selectedMetrics}
          compare={compare}
          chips={chips}
          onSetGranularity={setGranularity}
          onSetGroupBy={setGroupByWithMetricMode}
          onToggleMetric={toggleMetric}
          onToggleCompare={toggleCompare}
          onEditChip={editChip}
          onRemoveChip={removeChip}
          onClearAll={clearAll}
          granularityRef={granularityRef}
          groupRef={groupRef}
          compareRef={compareRef}
          metricRef={metricRef}
          groupOptions={dynamicGroupOptions}
          groupValueOptions={groupOptionsQuery.data?.groupValueOptions ?? []}
          selectedGroupValues={draftGroupValues}
          onToggleGroupValue={(value) =>
            setDraftGroupValues((current) =>
              current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
            )
          }
          onClearGroupValues={() => setDraftGroupValues([])}
          onApplyGroupFilters={applyGroupFilters}
          hasPendingGroupChanges={hasPendingGroupChanges}
          groupValuesLoading={groupValuesLoading}
        />

        <div className="cost-explorer-unified-shell__divider" aria-hidden="true" />

        <section className="cost-history-card">
          <h2 className="cost-history-card__title">History</h2>
          <p className="cost-history-card__message">Welcome into history.</p>
        </section>
      </section>
    </div>
  );
}
