import { Link, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";

import type { AnomalyRecord } from "../../api/dashboardApi";
import type { AnomalyTimelinePoint } from "../../api/dashboardTypes";
import { useAnomalyAlertDetailQuery, useAnomalyTimelineQuery } from "../../hooks/useDashboardQueries";

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

const toNumber = (value: string | number | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
};

const formatPercent = (value: string | number | null | undefined): string => {
  const numeric = toNumber(value);
  const normalized = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  return `${normalized.toFixed(2)}%`;
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

const mapStatus = (status: string | null | undefined): string => {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "open") return "Active";
  if (normalized === "resolved") return "Resolved";
  if (normalized === "ignored") return "Ignored";
  return "-";
};

const mapSeverity = (severity: string | null | undefined): string => {
  const normalized = String(severity ?? "").toLowerCase();
  if (!normalized) return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const toDurationLabel = (anomaly: AnomalyRecord): string => {
  const startRaw = anomaly.first_seen_at ?? anomaly.detected_at;
  const isOpen = String(anomaly.status ?? "").toLowerCase() === "open";
  const endRaw = isOpen ? new Date().toISOString() : anomaly.last_seen_at ?? anomaly.resolved_at ?? anomaly.detected_at;
  if (!startRaw || !endRaw) return "-";
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";
  const totalMinutes = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60)));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""}`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const getInsight = (anomaly: AnomalyRecord): string => {
  const explanation = asRecord(anomaly.explanation_json);
  const fromExplanation = readString(explanation, ["insightTitle", "insight", "summary"]);
  return fromExplanation ?? anomaly.anomaly_type ?? "Unknown anomaly";
};

const getBucket = (anomaly: AnomalyRecord): string => {
  const metadata = asRecord(anomaly.metadata_json);
  return (
    anomaly.resource_name ??
    anomaly.resource_id ??
    readString(metadata, ["bucket", "bucketName", "bucket_name", "resourceName"]) ??
    "-"
  );
};

const getRegion = (anomaly: AnomalyRecord): string =>
  anomaly.region ?? anomaly.region_name ?? "Global/Unknown";

const getService = (anomaly: AnomalyRecord): string =>
  anomaly.service ?? anomaly.service_name ?? "Amazon S3";

const getAccountId = (anomaly: AnomalyRecord): string => {
  const metadata = asRecord(anomaly.metadata_json);
  return anomaly.sub_account_id ?? readString(metadata, ["accountId", "subAccountId"]) ?? "-";
};

const getCostImpactType = (anomaly: AnomalyRecord): string => (toNumber(anomaly.delta_cost) >= 0 ? "Increase" : "Decrease");

const getHeaderRows = (anomaly: AnomalyRecord): Array<{ label: string; value: string }> => [
  { label: "Insight", value: getInsight(anomaly) },
  { label: "Service", value: getService(anomaly) },
  { label: "Status", value: mapStatus(anomaly.status) },
  { label: "Severity", value: mapSeverity(anomaly.severity) },
  { label: "Start Date", value: formatDate(anomaly.usage_date) },
  { label: "Duration", value: toDurationLabel(anomaly) },
  { label: "Account ID", value: getAccountId(anomaly) },
  { label: "Region", value: getRegion(anomaly) },
  { label: "Bucket", value: getBucket(anomaly) },
  { label: "Cost Impact Type", value: getCostImpactType(anomaly) },
  { label: "Cost Impact", value: currencyFormatter.format(Math.abs(toNumber(anomaly.delta_cost))) },
  { label: "Cost Impact %", value: formatPercent(anomaly.delta_percent) },
  { label: "Total Cost", value: currencyFormatter.format(toNumber(anomaly.actual_cost)) },
  { label: "Expected Cost", value: currencyFormatter.format(toNumber(anomaly.expected_cost)) },
];

type PeriodOption = 3 | 7 | 14 | 30 | 90;

type TrendPoint = AnomalyTimelinePoint & {
  dateLabel: string;
  isSynthetic?: boolean;
};

const PERIOD_OPTIONS: PeriodOption[] = [3, 7, 14, 30, 90];

const parseIsoDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const normalized = value.length <= 10 ? `${value}T00:00:00.000Z` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDurationLabelFromDates = (startDate: string | null | undefined, endDate: string | null | undefined): string => {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) return "-";
  const days = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  if (days <= 0) return "1 day";
  return `${days} day${days > 1 ? "s" : ""}`;
};

function AnomalyMarkerDot(props: { cx?: number; cy?: number; payload?: TrendPoint }) {
  const { cx, cy, payload } = props;
  if (!payload?.is_anomaly || typeof cx !== "number" || typeof cy !== "number") {
    return null;
  }

  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#0f5ea8" stroke="#ffffff" strokeWidth={2} />
    </g>
  );
}

export default function AnomalyAlertDetailPage() {
  const params = useParams<{ anomalyId: string }>();
  const anomalyId = String(params.anomalyId ?? "").trim();
  const detailQuery = useAnomalyAlertDetailQuery(anomalyId || null);
  const [period, setPeriod] = useState<PeriodOption>(14);
  const timelineQuery = useAnomalyTimelineQuery(anomalyId || null, period);
  const anomalyFromQuery = detailQuery.data ?? null;

  const trendData = useMemo<TrendPoint[]>(() => {
    const timeline = timelineQuery.data?.timeline ?? [];
    const base = timeline.map((point) => ({
      ...point,
      dateLabel: formatDate(point.date),
    }));
    if (base.length !== 1) return base;
    const only = base[0];
    const d = parseIsoDate(only.date);
    if (!d) return base;
    const prev = new Date(d);
    prev.setUTCDate(prev.getUTCDate() - 1);
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);
    return [
      {
        ...only,
        date: prev.toISOString().slice(0, 10),
        dateLabel: formatDate(prev.toISOString()),
        is_anomaly: false,
        isSynthetic: true,
      },
      only,
      {
        ...only,
        date: next.toISOString().slice(0, 10),
        dateLabel: formatDate(next.toISOString()),
        is_anomaly: false,
        isSynthetic: true,
      },
    ];
  }, [timelineQuery.data?.timeline]);

  const headerRows = useMemo(
    () => (anomalyFromQuery ? getHeaderRows(anomalyFromQuery) : []),
    [anomalyFromQuery],
  );
  const totalCostRows = useMemo(
    () => trendData.filter((row) => toNumber(row.cost) > 0),
    [trendData],
  );

  if (detailQuery.isLoading) {
    return <section className="dashboard-page anomaly-ref-page"><p>Loading anomaly details...</p></section>;
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section className="dashboard-page anomaly-ref-page">
        <p>Failed to load anomaly details.</p>
        <Link to="/dashboard/anomalies-alerts" className="anomaly-ref-date-link">Back to anomalies list</Link>
      </section>
    );
  }

  const anomaly = detailQuery.data;

  const anomalyStartDate = anomaly.usage_date;
  const anomalyEndDate =
    anomaly.resolved_at ??
    anomaly.last_seen_at ??
    anomaly.usage_date;
  const anomalyDuration = getDurationLabelFromDates(anomalyStartDate, anomalyEndDate);
  const selectedRelatedAnomalies = [
    {
      id: anomaly.id,
      date: anomaly.usage_date ?? "",
      anomaly_type: anomaly.anomaly_type ?? "-",
      status: anomaly.status ?? "open",
      cost_impact: Math.abs(toNumber(anomaly.delta_cost)),
      cost_impact_percentage: toNumber(anomaly.delta_percent),
    },
  ];

  const tooltipStartDate = formatDate(anomalyStartDate);
  const tooltipCostImpact = currencyFormatter.format(Math.abs(toNumber(anomaly.delta_cost)));
  const tooltipCostImpactPct = formatPercent(anomaly.delta_percent);
  const tooltipStatus = mapStatus(anomaly.status);
  const tooltipImpactType = getCostImpactType(anomaly);

  return (
    <section className="dashboard-page anomalies-alerts-page anomaly-ref-page" aria-label="Anomaly Detail">
      <div className="anomaly-detail-header">
        <div>
          <h2 className="anomaly-ref-title">Anomaly Details</h2>
        </div>
      </div>

      <section className="anomaly-detail-summary" aria-label="Header summary">
        {headerRows.map((row) => (
          <div key={row.label} className="anomaly-detail-summary__item">
            <p className="anomaly-detail-summary__label">{row.label}:</p>
            <p className="anomaly-detail-summary__value">{row.value}</p>
          </div>
        ))}
      </section>

      <section className="anomaly-detail-chart-card" aria-label="Total cost and anomaly trend">
        <div className="anomaly-detail-chart-card__header">
          <h3 className="anomaly-detail-chart-card__title">Total Cost and Anomaly Trend</h3>
          <div className="anomaly-detail-chart-card__filters">
            <label className="anomaly-detail-chart-card__period">
              <span>Time Period</span>
              <select
                value={period}
                onChange={(event) => setPeriod(Number(event.target.value) as PeriodOption)}
                className="anomaly-detail-chart-card__select"
              >
                {PERIOD_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    Last {item} days
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="anomaly-detail-chart-card__body">
          {timelineQuery.isLoading ? (
            <p className="anomaly-detail-chart-card__loading">Loading trend data...</p>
          ) : trendData.length === 0 ? (
            <p className="anomaly-detail-chart-card__loading">No timeline data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendData} margin={{ top: 10, right: 24, left: 2, bottom: 6 }}>
                <defs>
                  <pattern id="anomalyStripePattern" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="8" height="8" fill="rgba(15, 94, 168, 0.12)" />
                    <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(15, 94, 168, 0.7)" strokeWidth="2" />
                  </pattern>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#d5dde5" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fill: "#4b5f6d", fontSize: 12, fontWeight: 560 }}
                  tickLine={false}
                  axisLine={{ stroke: "#c7d2db" }}
                  minTickGap={18}
                  tickMargin={8}
                  padding={{ right: 12 }}
                />
                <YAxis
                  tick={{ fill: "#4b5f6d", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "#c7d2db" }}
                  tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
                  width={44}
                  tickMargin={6}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0]?.payload as TrendPoint | undefined;
                    if (!row) return null;
                    return (
                      <div className="anomaly-detail-chart-tooltip">
                        <p className="anomaly-detail-chart-tooltip__line">{row.dateLabel}</p>
                        <p className="anomaly-detail-chart-tooltip__line">Cost: {currencyFormatter.format(toNumber(row.cost))}</p>
                        <p className="anomaly-detail-chart-tooltip__title">Anomaly Details</p>
                        <p className="anomaly-detail-chart-tooltip__line">Start Date: {tooltipStartDate}</p>
                        <p className="anomaly-detail-chart-tooltip__line">Duration: {anomalyDuration}</p>
                        <p className="anomaly-detail-chart-tooltip__line">Cost Impact Type: {tooltipImpactType}</p>
                        <p className="anomaly-detail-chart-tooltip__line">Cost Impact: {tooltipCostImpact}</p>
                        <p className="anomaly-detail-chart-tooltip__line">Cost Impact Percentage: {tooltipCostImpactPct}</p>
                        <p className="anomaly-detail-chart-tooltip__line">Status: {tooltipStatus}</p>
                      </div>
                    );
                  }}
                />
                <ReferenceArea
                  x1={formatDate(anomalyStartDate)}
                  x2={trendData[trendData.length - 1]?.dateLabel ?? formatDate(anomalyEndDate)}
                  fill="url(#anomalyStripePattern)"
                  fillOpacity={0.45}
                  strokeOpacity={0}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="#1f6cb0"
                  strokeWidth={3}
                  connectNulls={false}
                  dot={(dotProps) => <AnomalyMarkerDot {...dotProps} />}
                  activeDot={{ r: 7, strokeWidth: 2, stroke: "#ffffff" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="anomaly-detail-data-grid" aria-label="Anomaly data tables">
        <article className="anomaly-detail-data-panel anomaly-detail-data-panel--left">
          <h4>Data View by Total Cost</h4>
          <div className="anomaly-detail-data-panel__table-wrap">
            <table className="anomaly-detail-data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Cost</th>
                </tr>
              </thead>
                <tbody>
                {totalCostRows.map((row) => (
                  <tr key={row.date}>
                    <td>{row.dateLabel}</td>
                    <td className="anomaly-detail-data-table__num">{currencyFormatter.format(toNumber(row.cost))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="anomaly-detail-data-panel__footer">{totalCostRows.length} Days</p>
        </article>

        <article className="anomaly-detail-data-panel anomaly-detail-data-panel--right">
          <h4>Data View by Anomalies</h4>
          <div className="anomaly-detail-data-panel__table-wrap">
            <table className="anomaly-detail-data-table">
              <thead>
                <tr>
                  <th>Start Date</th>
                  <th>Duration</th>
                  <th>Cost Impact Type</th>
                  <th>Cost Impact</th>
                  <th>Cost Impact Percentage</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th>Feedback</th>
                </tr>
              </thead>
              <tbody>
                {selectedRelatedAnomalies.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.date)}</td>
                    <td>{anomalyDuration}</td>
                    <td>
                      <span className="anomaly-detail-data-table__trend">
                        {toNumber(row.cost_impact) >= 0 ? "↑ Increase" : "↓ Decrease"}
                      </span>
                    </td>
                    <td className="anomaly-detail-data-table__impact">{currencyFormatter.format(Math.abs(toNumber(row.cost_impact)))}</td>
                    <td>{formatPercent(row.cost_impact_percentage)}</td>
                    <td>{currencyFormatter.format(toNumber(anomaly.actual_cost))}</td>
                    <td>
                      <span className="anomaly-detail-data-table__status">{mapStatus(row.status)}</span>
                    </td>
                    <td>Not Submitted</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="anomaly-detail-data-panel__footer">{selectedRelatedAnomalies.length} Anomaly</p>
        </article>
      </section>
    </section>
  );
}
