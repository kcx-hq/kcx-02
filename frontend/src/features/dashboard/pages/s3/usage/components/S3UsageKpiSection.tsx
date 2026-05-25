import { useState } from "react";
import type { S3CostInsightsResponse } from "../../../../api/dashboardApi";

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const formatDataSize = (valueInGb: number): string => {
  const safeGb = Number.isFinite(valueInGb) ? Math.max(0, valueInGb) : 0;
  if (safeGb >= 1024) {
    const tb = safeGb / 1024;
    return `${tb.toFixed(tb >= 100 ? 0 : tb >= 10 ? 1 : 2)} TB`;
  }
  return `${safeGb.toFixed(safeGb >= 100 ? 0 : safeGb >= 10 ? 1 : 2)} GB`;
};

const formatGb = (valueInGb: number): string => {
  const safeGb = Number.isFinite(valueInGb) ? Math.max(0, valueInGb) : 0;
  return `${safeGb.toFixed(safeGb >= 100 ? 0 : safeGb >= 10 ? 1 : 2)} GB`;
};

type Props = {
  kpis: S3CostInsightsResponse["kpis"]["usageSummaryKpis"] | undefined;
  seriesBy?: "bucket" | "operation_group";
  category?: "" | "storage" | "data_transfer" | "request" | "object_count";
  topRequestGroup?: string;
  highestRequestBucket?: string;
  topTransferOperationGroup?: string;
  highestTransferBucket?: string;
  isLoading?: boolean;
};

export function S3UsageKpiSection({
  kpis,
  seriesBy = "bucket",
  category = "",
  topRequestGroup = "--",
  highestRequestBucket = "--",
  topTransferOperationGroup = "--",
  highestTransferBucket = "--",
  isLoading = false,
}: Props) {
  if (isLoading) {
    return (
      <section className="cost-explorer-kpi-surface s3-overview-kpi-surface" aria-label="S3 usage key metrics">
        <div className="cost-explorer-chart-insights s3-overview-kpi-row s3-usage-kpi-row--skeleton" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <article key={`s3-usage-kpi-skeleton-${index}`} className="cost-explorer-insight-tile s3-overview-kpi-tile s3-usage-kpi-row__item">
              <div className="s3-usage-kpi-row__skeleton-label" />
              <div className="s3-usage-kpi-row__skeleton-value" />
            </article>
          ))}
        </div>
      </section>
    );
  }

  const values = {
    totalStorageGb: Number(kpis?.totalStorageGb ?? 0),
    totalRequests: Number(kpis?.totalRequests ?? 0),
    totalTransferGb: Number(kpis?.totalTransferGb ?? 0),
    totalObjectCount: Number(kpis?.totalObjectCount ?? 0),
  };
  const showOperationRequestKpis = seriesBy === "operation_group" && category === "request";
  const showOperationTransferKpis = seriesBy === "operation_group" && category === "data_transfer";
  const [expandedKpi, setExpandedKpi] = useState<"highestRequestBucket" | "highestTransferBucket" | null>(null);

  return (
    <section className="cost-explorer-kpi-surface s3-overview-kpi-surface" aria-label="S3 usage key metrics">
      <div className="cost-explorer-chart-insights s3-overview-kpi-row">
        {showOperationRequestKpis || showOperationTransferKpis ? null : (
          <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
            <p className="cost-explorer-insight-tile__label">Total Storage</p>
            <p className="cost-explorer-insight-tile__value">{formatGb(values.totalStorageGb)}</p>
          </article>
        )}
        <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
          <p className="cost-explorer-insight-tile__label">Total Requests</p>
          <p className="cost-explorer-insight-tile__value">{compactNumberFormatter.format(Math.max(0, values.totalRequests))}</p>
        </article>
        <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
          <p className="cost-explorer-insight-tile__label">Total Transfer</p>
          <p className="cost-explorer-insight-tile__value">{formatDataSize(values.totalTransferGb)}</p>
        </article>
        {showOperationRequestKpis ? (
          <>
            <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
              <p className="cost-explorer-insight-tile__label">Top Request Group</p>
              <p className="cost-explorer-insight-tile__value">{topRequestGroup || "--"}</p>
            </article>
            <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
              <p className="cost-explorer-insight-tile__label">Highest Request Bucket</p>
              <p
                className={`cost-explorer-insight-tile__value s3-overview-kpi-tile__value--expandable${expandedKpi === "highestRequestBucket" ? " is-expanded" : ""}`}
                title={highestRequestBucket || "--"}
                onClick={() => setExpandedKpi((current) => (current === "highestRequestBucket" ? null : "highestRequestBucket"))}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setExpandedKpi((current) => (current === "highestRequestBucket" ? null : "highestRequestBucket"));
                  }
                }}
              >
                {highestRequestBucket || "--"}
              </p>
            </article>
          </>
        ) : showOperationTransferKpis ? (
          <>
            <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
              <p className="cost-explorer-insight-tile__label">Top Transfer Operation Group</p>
              <p className="cost-explorer-insight-tile__value">{topTransferOperationGroup || "--"}</p>
            </article>
            <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
              <p className="cost-explorer-insight-tile__label">Highest Transfer Bucket</p>
              <p
                className={`cost-explorer-insight-tile__value s3-overview-kpi-tile__value--expandable${expandedKpi === "highestTransferBucket" ? " is-expanded" : ""}`}
                title={highestTransferBucket || "--"}
                onClick={() => setExpandedKpi((current) => (current === "highestTransferBucket" ? null : "highestTransferBucket"))}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setExpandedKpi((current) => (current === "highestTransferBucket" ? null : "highestTransferBucket"));
                  }
                }}
              >
                {highestTransferBucket || "--"}
              </p>
            </article>
          </>
        ) : (
          <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
            <p className="cost-explorer-insight-tile__label">Total Object Count</p>
            <p className="cost-explorer-insight-tile__value">{compactNumberFormatter.format(Math.max(0, values.totalObjectCount))}</p>
          </article>
        )}
      </div>
    </section>
  );
}
