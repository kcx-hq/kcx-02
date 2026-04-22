import { useMemo, useState } from "react";
import { AnomalyDetectionHeader } from "./components/AnomalyDetectionHeader";
import { type AnomalyFiltersState, AnomalyFiltersPanel } from "./components/AnomalyFiltersPanel";
import { AnomalyDetectionKpis } from "./components/AnomalyDetectionKpis";
import { type AnomalyTableRow, AnomalyDetectionTable } from "./components/AnomalyDetectionTable";
import { useAnomaliesAlertsQuery } from "../../hooks/useDashboardQueries";
import type { AnomaliesFiltersQuery, AnomalyRecord } from "../../api/dashboardApi";

const DEFAULT_FILTERS: AnomalyFiltersState = {
  timePeriod: "Last 14 days",
  accountName: "All",
  service: "All",
  region: "All",
  marketplace: "All",
  costImpactType: "Increase",
  costImpactOperator: "Greater than ($)",
  costImpactValue: "",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
});

const shortDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const toNumber = (value: number | string | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateTimeFormatter.format(parsed);
};

const formatPercent = (value: number | string | null | undefined): string => {
  const numeric = toNumber(value);
  const normalized = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  return `${normalized.toFixed(2)}%`;
};

const formatShortDateTime = (value: Date): string => shortDateTimeFormatter.format(value);

const formatDurationFromMs = (diffMs: number): string => {
  if (diffMs <= 0) return "0m";
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatSeenWindowDuration = (anomaly: AnomalyRecord): string => {
  const startRaw = anomaly.first_seen_at ?? anomaly.detected_at;
  const isActive = String(anomaly.status ?? "").toLowerCase() === "open";
  const endRaw = isActive ? new Date().toISOString() : anomaly.last_seen_at ?? anomaly.resolved_at ?? anomaly.detected_at;

  if (!startRaw || !endRaw) return "-";
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";

  const startLabel = formatShortDateTime(start);
  const endLabel = isActive ? "Now" : formatShortDateTime(end);
  const durationLabel = formatDurationFromMs(Math.max(0, end.getTime() - start.getTime()));
  return `${startLabel} -> ${endLabel} (${durationLabel})`;
};

const toSentence = (value: string | null | undefined): string => {
  if (!value) return "Unknown anomaly";
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const readString = (source: Record<string, unknown> | null, keys: string[]): string | null => {
  if (!source) return null;
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
};

const buildInsightText = (anomaly: AnomalyRecord): string => {
  const rootHint = anomaly.root_cause_hint?.trim();
  if (rootHint) return rootHint;

  const explanation = asRecord(anomaly.explanation_json);
  const explanationHint = readString(explanation, ["insight", "summary", "reason", "message", "rootCauseHint"]);
  if (explanationHint) return explanationHint;

  const firstContributor = Array.isArray(anomaly.contributors) ? anomaly.contributors[0] : null;
  if (firstContributor?.dimension_value) {
    return `Primary driver: ${firstContributor.dimension_value}`;
  }

  const delta = currencyFormatter.format(Math.abs(toNumber(anomaly.delta_cost)));
  return `${toSentence(anomaly.anomaly_type)} with ${delta} impact`;
};

const toRoundedCents = (value: number | string | null | undefined): number =>
  Math.round(Math.abs(toNumber(value)) * 100);

const toStatusRank = (status: string | null | undefined): number => {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "open") return 3;
  if (normalized === "resolved") return 2;
  if (normalized === "ignored") return 1;
  return 0;
};

const toTypeRank = (anomalyType: string | null | undefined): number => {
  const normalized = String(anomalyType ?? "").toLowerCase();
  if (normalized === "sudden_cost_spike") return 2;
  if (normalized === "new_high_cost_instance") return 1;
  return 0;
};

const extractInstanceId = (anomaly: AnomalyRecord): string | null => {
  const metadata = asRecord(anomaly.metadata_json);
  const fromMetadata = readString(metadata, ["instanceId", "instance_id"]);
  if (fromMetadata) return fromMetadata;

  const contributors = Array.isArray(anomaly.contributors) ? anomaly.contributors : [];
  const instanceContributor = contributors.find(
    (entry) =>
      String(entry.dimension_type ?? "").toLowerCase() === "instance_id" &&
      typeof entry.dimension_value === "string" &&
      entry.dimension_value.trim().length > 0,
  );
  return instanceContributor?.dimension_value?.trim() ?? null;
};

const buildDuplicateIncidentKey = (anomaly: AnomalyRecord): string => {
  const instanceId = extractInstanceId(anomaly) ?? "-";
  const usageDate = anomaly.usage_date ?? "-";
  const accountId = anomaly.sub_account_id ?? "-";
  const region = (anomaly.region ?? anomaly.region_name ?? "-").toLowerCase();
  const deltaCostCents = toRoundedCents(anomaly.delta_cost);
  const actualCostCents = toRoundedCents(anomaly.actual_cost);
  return [usageDate, instanceId, accountId, region, String(deltaCostCents), String(actualCostCents)].join("|");
};

const pickPreferredAnomaly = (current: AnomalyRecord, next: AnomalyRecord): AnomalyRecord => {
  const statusDiff = toStatusRank(next.status) - toStatusRank(current.status);
  if (statusDiff !== 0) return statusDiff > 0 ? next : current;

  const typeDiff = toTypeRank(next.anomaly_type) - toTypeRank(current.anomaly_type);
  if (typeDiff !== 0) return typeDiff > 0 ? next : current;

  const currentDetected = new Date(current.detected_at ?? 0).getTime();
  const nextDetected = new Date(next.detected_at ?? 0).getTime();
  return nextDetected >= currentDetected ? next : current;
};

const dedupeAnomaliesByIncident = (rows: AnomalyRecord[]): AnomalyRecord[] => {
  const byIncident = new Map<string, AnomalyRecord>();
  for (const row of rows) {
    const key = buildDuplicateIncidentKey(row);
    const existing = byIncident.get(key);
    if (!existing) {
      byIncident.set(key, row);
      continue;
    }
    byIncident.set(key, pickPreferredAnomaly(existing, row));
  }
  return Array.from(byIncident.values());
};

const resolveServiceText = (anomaly: AnomalyRecord): string => {
  const metadata = asRecord(anomaly.metadata_json);
  const fromMetadata = readString(metadata, [
    "service",
    "service_name",
    "serviceName",
    "aws_service",
    "awsService",
  ]);
  return anomaly.service ?? anomaly.service_name ?? fromMetadata ?? "-";
};

const resolveTimeRange = (timePeriod: string): Pick<AnomaliesFiltersQuery, "date_from" | "date_to"> => {
  const normalized = timePeriod.trim().toLowerCase();
  const daysMatch = normalized.match(/last\s+(\d+)\s+days?/);
  if (!daysMatch) return {};

  const days = Number(daysMatch[1]);
  if (!Number.isFinite(days) || days <= 0) return {};

  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));

  const toIso = to.toISOString().slice(0, 10);
  const fromIso = from.toISOString().slice(0, 10);
  return { date_from: fromIso, date_to: toIso };
};

const mapAnomalyToRow = (anomaly: AnomalyRecord): AnomalyTableRow => {
  const delta = toNumber(anomaly.delta_cost);
  const impactType = delta >= 0 ? "Increase" : "Decrease";
  const status = String(anomaly.status ?? "").toLowerCase() === "open" ? "Active" : "Inactive";

  return {
    id: anomaly.id,
    startDate: formatDate(anomaly.usage_date),
    insight: buildInsightText(anomaly),
    duration: formatSeenWindowDuration(anomaly),
    accountId: anomaly.sub_account_id ?? "-",
    accountName: anomaly.account_name ?? anomaly.sub_account_name ?? "-",
    service: resolveServiceText(anomaly),
    region: anomaly.region ?? anomaly.region_name ?? "-",
    costImpactType: impactType,
    costImpact: currencyFormatter.format(Math.abs(delta)),
    costImpactPercentage: formatPercent(anomaly.delta_percent),
    cost: currencyFormatter.format(toNumber(anomaly.actual_cost)),
    status,
    severity: anomaly.severity,
  };
};

export default function AnomaliesAlertsPage() {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<AnomalyFiltersState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AnomalyFiltersState>(DEFAULT_FILTERS);
  const [searchTerm, setSearchTerm] = useState("");

  const queryFilters = useMemo<AnomaliesFiltersQuery>(() => {
    const next: AnomaliesFiltersQuery = {
      ...resolveTimeRange(appliedFilters.timePeriod),
      limit: 200,
      offset: 0,
    };
    return next;
  }, [appliedFilters.timePeriod]);

  const anomaliesQuery = useAnomaliesAlertsQuery(queryFilters);
  const rawRows = anomaliesQuery.data?.items ?? [];
  const dedupedRows = useMemo(() => dedupeAnomaliesByIncident(rawRows), [rawRows]);

  const insights = useMemo(() => {
    const items = [
      `Time: ${appliedFilters.timePeriod}`,
      `Account: ${appliedFilters.accountName}`,
      `Service: ${appliedFilters.service}`,
      `Region: ${appliedFilters.region}`,
      `Marketplace: ${appliedFilters.marketplace}`,
      `Impact Type: ${appliedFilters.costImpactType}`,
    ];

    if (appliedFilters.costImpactValue.trim()) {
      items.push(`Cost Impact: ${appliedFilters.costImpactOperator} ${appliedFilters.costImpactValue}`);
    } else {
      items.push(`Cost Impact: ${appliedFilters.costImpactOperator}`);
    }

    return items;
  }, [appliedFilters]);

  const filteredAnomalies = useMemo(() => {
    const minImpact = appliedFilters.costImpactValue.trim() ? Number(appliedFilters.costImpactValue) : null;
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const accountFilter = appliedFilters.accountName.trim().toLowerCase();
    const serviceFilter = appliedFilters.service.trim().toLowerCase();
    const regionFilter = appliedFilters.region.trim().toLowerCase();
    return dedupedRows
      .filter((item) => {
        if (appliedFilters.costImpactType === "Increase") {
          return toNumber(item.delta_cost) >= 0;
        }
        if (appliedFilters.costImpactType === "Decrease") {
          return toNumber(item.delta_cost) < 0;
        }
        return true;
      })
      .filter((item) => {
        if (minImpact === null || Number.isNaN(minImpact)) return true;
        return Math.abs(toNumber(item.delta_cost)) >= minImpact;
      })
      .filter((item) => {
        if (accountFilter && accountFilter !== "all") {
          const value = (item.account_name ?? item.sub_account_name ?? "").toLowerCase();
          if (!value.includes(accountFilter)) return false;
        }
        if (serviceFilter && serviceFilter !== "all") {
          const value = (item.service ?? item.service_name ?? "").toLowerCase();
          if (!value.includes(serviceFilter)) return false;
        }
        if (regionFilter && regionFilter !== "all") {
          const value = (item.region ?? item.region_name ?? "").toLowerCase();
          if (!value.includes(regionFilter)) return false;
        }
        return true;
      })
      .filter((item) => {
        const mapped = mapAnomalyToRow(item);
        if (!normalizedSearch) return true;
        return [
          mapped.insight,
          mapped.accountId,
          mapped.accountName,
          mapped.service,
          mapped.region,
          mapped.status,
          mapped.severity,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      });
  }, [
    appliedFilters.accountName,
    appliedFilters.costImpactType,
    appliedFilters.costImpactValue,
    appliedFilters.region,
    appliedFilters.service,
    dedupedRows,
    searchTerm,
  ]);

  const tableRows = useMemo(() => filteredAnomalies.map(mapAnomalyToRow), [filteredAnomalies]);

  const activeCount = useMemo(() => {
    return filteredAnomalies.filter((item) => String(item.status ?? "").toLowerCase() === "open").length;
  }, [filteredAnomalies]);
  const inactiveCount = Math.max(0, tableRows.length - activeCount);

  const totalCostImpact = useMemo(
    () => filteredAnomalies.reduce((sum, item) => sum + Math.abs(toNumber(item.delta_cost)), 0),
    [filteredAnomalies],
  );
  const totalCost = useMemo(
    () => filteredAnomalies.reduce((sum, item) => sum + Math.abs(toNumber(item.actual_cost)), 0),
    [filteredAnomalies],
  );
  const impactPct =
    totalCost > 0 ? `${((totalCostImpact / totalCost) * 100).toFixed(2)}%` : "0.00%";

  const fetchedCount = dedupedRows.length;

  const asOfSourceRows = dedupedRows.length > 0 ? dedupedRows : rawRows;
  const asOfLabelFromDeduped = useMemo(() => {
    const latest = asOfSourceRows
      .map((item) => item.detected_at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    return `As of ${latest ? formatDateTime(latest) : "--/--/----, --:--:--"}`;
  }, [asOfSourceRows]);

  function openFilters() {
    setDraftFilters(appliedFilters);
    setIsFiltersOpen(true);
  }

  function resetDraftFilters() {
    setDraftFilters(DEFAULT_FILTERS);
  }

  function applyFilters() {
    setAppliedFilters(draftFilters);
    setIsFiltersOpen(false);
  }

  return (
    <section className="dashboard-page anomalies-alerts-page anomaly-ref-page" aria-label="Anomaly Detection">
      <AnomalyDetectionHeader onOpenFilters={openFilters} asOfLabel={asOfLabelFromDeduped} />

      <section className="anomaly-ref-insights" aria-label="Applied filter insights">
        {insights.map((item) => (
          <span key={item} className="anomaly-ref-insight-chip">
            {item}
          </span>
        ))}
        <span className="anomaly-ref-insight-chip">Fetched: {fetchedCount} anomalies</span>
      </section>

      <AnomalyDetectionKpis
        anomalyCount={tableRows.length}
        totalCostImpact={currencyFormatter.format(totalCostImpact)}
        totalCost={currencyFormatter.format(totalCost)}
        impactPercent={impactPct}
      />
      <AnomalyDetectionTable
        rows={tableRows}
        activeCount={activeCount}
        inactiveCount={inactiveCount}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        isLoading={anomaliesQuery.isLoading}
        errorMessage={anomaliesQuery.isError ? anomaliesQuery.error.message : null}
      />

      <AnomalyFiltersPanel
        open={isFiltersOpen}
        filters={draftFilters}
        onChange={setDraftFilters}
        onReset={resetDraftFilters}
        onCancel={() => setIsFiltersOpen(false)}
        onApply={applyFilters}
      />
    </section>
  );
}
