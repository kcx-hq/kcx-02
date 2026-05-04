import { useMemo } from "react";
import { useS3OptimizationQuery } from "../../hooks/useDashboardQueries";

const toStatusLabel = (value: string | null): string => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "Unknown";
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const formatScanTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-US", { year: "numeric", month: "short", day: "2-digit" });
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
};

const toPolicyAppliedLabel = (value: string | null | undefined): string => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "APPLIED") return "Applied";
  if (normalized === "FAILED") return "Failed";
  if (normalized === "EXTERNAL") return "Applied";
  return "Not Applied";
};

export default function S3OptimizationPage() {
  const query = useS3OptimizationQuery();
  const rows = useMemo(() => query.data?.buckets ?? [], [query.data?.buckets]);

  return (
    <div className="dashboard-page optimization-page">
      <div className="cost-explorer-widget-shell">
        <header className="cost-explorer-widget-shell__header">
          <h2>S3 LifeCycle Policy</h2>
        </header>

        {query.isLoading ? <p className="dashboard-note">Loading S3 lifecycle policy data...</p> : null}
        {query.isError ? <p className="dashboard-note">Failed to load S3 lifecycle policy data: {query.error.message}</p> : null}

        {!query.isLoading && !query.isError ? (
          <div className="optimization-rightsizing-table-scroll">
            <table className="optimization-rightsizing-table">
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th>Lifecycle Policy</th>
                  <th>Policy Applied</th>
                  <th>Lifecycle Status</th>
                  <th>Rules</th>
                  <th>Savings Status</th>
                  <th>Estimated Savings</th>
                  <th>Realized Savings</th>
                  <th>Account</th>
                  <th>Region</th>
                  <th>Last Scan</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="optimization-rightsizing-empty">
                      <p className="optimization-rightsizing-empty__title">No buckets found</p>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={`${row.bucketName}-${row.accountId}`}>
                      <td>{row.bucketName || "--"}</td>
                      <td>{row.hasLifecyclePolicy ? "Configured" : "Missing"}</td>
                      <td>{toPolicyAppliedLabel(row.policyAppliedStatus)}</td>
                      <td>{toStatusLabel(row.lifecycleStatus)}</td>
                      <td>{row.lifecycleRulesCount ?? 0}</td>
                      <td>{toStatusLabel(row.lifecycleSavings?.status ?? null)}</td>
                      <td>
                        {row.lifecycleSavings?.estimatedMonthlySavingsMin != null && row.lifecycleSavings?.estimatedMonthlySavingsMax != null
                          ? `${formatCurrency(row.lifecycleSavings.estimatedMonthlySavingsMin)} - ${formatCurrency(row.lifecycleSavings.estimatedMonthlySavingsMax)} /mo`
                          : "--"}
                      </td>
                      <td>
                        {row.lifecycleSavings?.status === "realized"
                          ? `${formatCurrency(row.lifecycleSavings.realizedMonthlySavings)} (${row.lifecycleSavings.savingsPercent ?? 0}%)`
                          : row.lifecycleSavings?.status === "tracking"
                            ? "Available after 30 days"
                            : "--"}
                      </td>
                      <td>{row.accountId || "--"}</td>
                      <td>{row.region || "--"}</td>
                      <td>{formatScanTime(row.scanTime)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
