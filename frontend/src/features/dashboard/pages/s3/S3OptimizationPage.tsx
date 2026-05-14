import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useAutoCreateS3ReplicationRoleMutation,
  useApplyS3ReplicationSetupMutation,
  useS3CostInsightsQuery,
  usePreviewS3ReplicationSetupMutation,
  useS3OptimizationQuery,
  useS3ReplicationDestinationBucketsQuery,
  useS3ReplicationQuery,
} from "../../hooks/useDashboardQueries";
import { S3OptimizationOverviewSection } from "./components/S3OptimizationOverviewSection";

type S3OptimizationTabKey = "overview" | "lifecycle" | "replication";

const TAB_ITEMS: Array<{ key: S3OptimizationTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "lifecycle", label: "Lifecycle Policy" },
  { key: "replication", label: "Replication" },
];

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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  }).format(value);
};

const toPolicyAppliedLabel = (value: string | null | undefined): string => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "APPLIED") return "Applied";
  if (normalized === "FAILED") return "Failed";
  if (normalized === "EXTERNAL") return "Applied";
  return "Not Applied";
};

const toReplicationBadgeClass = (value: string | null | undefined): string => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "present") return "is-present";
  if (normalized === "absent") return "is-absent";
  return "is-unknown";
};

const toReplicationActionLabel = (value: string): string => {
  if (value === "setup_replication") return "Setup Replication";
  if (value === "view_setup_guide") return "View Setup Guide";
  if (value === "fix_permission") return "Fix Permission";
  return toStatusLabel(value);
};

export default function S3OptimizationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<S3OptimizationTabKey>("overview");
  const [showReplicationGuide, setShowReplicationGuide] = useState(false);
  const lifecycleQuery = useS3OptimizationQuery(activeTab === "lifecycle" || activeTab === "overview");
  const s3CostInsightsQuery = useS3CostInsightsQuery(undefined, {
    enabled: activeTab === "overview",
    staleTime: 180_000,
  });
  const replicationQuery = useS3ReplicationQuery(activeTab === "replication" || showReplicationGuide, {
    staleTime: 180_000,
    retry: 1,
  });
  const [showReplicationSlowHint, setShowReplicationSlowHint] = useState(false);
  const lifecycleRows = useMemo(() => lifecycleQuery.data?.buckets ?? [], [lifecycleQuery.data?.buckets]);
  const replicationRows = useMemo(() => replicationQuery.data?.buckets ?? [], [replicationQuery.data?.buckets]);
  const [replicationActionMessage, setReplicationActionMessage] = useState<string | null>(null);
  const [setupForm, setSetupForm] = useState({
    sourceBucketName: "",
    destinationBucketName: "",
    destinationRegion: "us-east-1",
    replicationType: "same_account" as "same_account" | "cross_account",
    destinationAccountId: "",
    replicationRoleArn: "",
    ruleName: "kcx-replication-rule",
    prefix: "",
    replicateDeleteMarkers: false,
    autoEnableSourceVersioning: true,
    autoEnableDestinationVersioning: false,
  });
  const previewMutation = usePreviewS3ReplicationSetupMutation();
  const applyMutation = useApplyS3ReplicationSetupMutation();
  const autoCreateRoleMutation = useAutoCreateS3ReplicationRoleMutation();
  const lastAutoRoleKeyRef = useRef<string>("");
  const destinationBucketsQuery = useS3ReplicationDestinationBucketsQuery(
    showReplicationGuide ? setupForm.sourceBucketName : null,
    showReplicationGuide,
  );
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const activeRowsCount = activeTab === "lifecycle" ? lifecycleRows.length : activeTab === "replication" ? replicationRows.length : 0;
  const totalItems = activeRowsCount;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, totalItems, activeTab]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    const waitingOnReplication =
      activeTab === "replication" &&
      replicationQuery.isLoading &&
      !replicationQuery.data &&
      !replicationQuery.isError;
    if (!waitingOnReplication) {
      setShowReplicationSlowHint(false);
      return;
    }
    const timeout = window.setTimeout(() => setShowReplicationSlowHint(true), 12_000);
    return () => window.clearTimeout(timeout);
  }, [activeTab, replicationQuery.data, replicationQuery.isError, replicationQuery.isLoading]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tab = String(searchParams.get("tab") ?? "").trim().toLowerCase();
    const bucketName = String(searchParams.get("bucketName") ?? "").trim();
    if (tab === "overview") {
      setActiveTab("overview");
    } else if (tab === "replication") {
      setActiveTab("replication");
      if (bucketName) {
        setSetupForm((prev) => ({ ...prev, sourceBucketName: bucketName }));
        setShowReplicationGuide(true);
      }
    } else if (tab === "lifecycle") {
      setActiveTab("lifecycle");
    }
  }, [location.search]);

  useEffect(() => {
    if (!showReplicationGuide) return;
    const sourceBucketName = String(setupForm.sourceBucketName ?? "").trim();
    const destinationBucketName = String(setupForm.destinationBucketName ?? "").trim();
    if (!sourceBucketName || !destinationBucketName) return;

    const autoRoleKey = `${sourceBucketName}::${destinationBucketName}`;
    if (autoRoleKey === lastAutoRoleKeyRef.current) return;
    if (autoCreateRoleMutation.isPending) return;

    lastAutoRoleKeyRef.current = autoRoleKey;
    void autoCreateRoleMutation
      .mutateAsync({ sourceBucketName, destinationBucketName })
      .then((result) => {
        setSetupForm((prev) => ({ ...prev, replicationRoleArn: result.roleArn }));
      })
      .catch(() => {
        setSetupForm((prev) => ({ ...prev, replicationRoleArn: "" }));
      });
  }, [
    autoCreateRoleMutation,
    showReplicationGuide,
    setupForm.destinationBucketName,
    setupForm.sourceBucketName,
  ]);

  const lifecyclePagedRows = useMemo(() => {
    if (activeTab !== "lifecycle") return [];
    const start = (currentPage - 1) * pageSize;
    return lifecycleRows.slice(start, start + pageSize);
  }, [activeTab, currentPage, lifecycleRows, pageSize]);
  const replicationPagedRows = useMemo(() => {
    if (activeTab !== "replication") return [];
    const start = (currentPage - 1) * pageSize;
    return replicationRows.slice(start, start + pageSize);
  }, [activeTab, currentPage, replicationRows, pageSize]);
  const startRow = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, totalItems);
  const replicationSummary = useMemo(() => {
    const present = replicationRows.filter((row) => row.replicationStatus === "present").length;
    const absent = replicationRows.filter((row) => row.replicationStatus === "absent").length;
    const unknown = replicationRows.filter((row) => row.replicationStatus === "unknown").length;
    return { present, absent, unknown, total: replicationRows.length };
  }, [replicationRows]);

  const openBucketDetail = (bucketName: string) => {
    const trimmed = String(bucketName ?? "").trim();
    if (!trimmed) return;
    const searchParams = new URLSearchParams(location.search);
    searchParams.set("s3Section", "usage");
    navigate({
      pathname: `/dashboard/s3/bucket/${encodeURIComponent(trimmed)}`,
      search: searchParams.toString(),
    });
  };

  const onReplicationAction = (action: string, bucketName: string) => {
    if (action === "view_setup_guide" || action === "setup_replication" || action === "fix_permission") {
      setSetupForm((prev) => ({ ...prev, sourceBucketName: bucketName }));
      setShowReplicationGuide(true);
      return;
    }
    setReplicationActionMessage(
      `${toReplicationActionLabel(action)} for ${bucketName} will be enabled after replication write APIs are completed.`,
    );
  };

  return (
    <div className="dashboard-page optimization-page">
      <div className="cost-explorer-widget-shell">


        <div className="optimization-header-tabs" role="tablist" aria-label="S3 optimization sections">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`optimization-header-tab ${activeTab === tab.key ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" ? (
          <>
            {s3CostInsightsQuery.isLoading ? <p className="dashboard-note">Loading S3 optimization overview...</p> : null}
            {s3CostInsightsQuery.isError ? <p className="dashboard-note">Failed to load S3 optimization overview: {s3CostInsightsQuery.error.message}</p> : null}
            <S3OptimizationOverviewSection
              costInsights={s3CostInsightsQuery.data}
              lifecycleRows={lifecycleRows}
            />
          </>
        ) : activeTab === "lifecycle" ? (
          <>
            {lifecycleQuery.isLoading ? <p className="dashboard-note">Loading S3 lifecycle policy data...</p> : null}
            {lifecycleQuery.isError ? <p className="dashboard-note">Failed to load S3 lifecycle policy data: {lifecycleQuery.error.message}</p> : null}

            {!lifecycleQuery.isLoading && !lifecycleQuery.isError ? (
              <div className="s3-lifecycle-table-shell">
                <div className="optimization-rightsizing-table-scroll">
                  <table className="optimization-rightsizing-table s3-lifecycle-table">
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
                      {lifecycleRows.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="optimization-rightsizing-empty">
                            <p className="optimization-rightsizing-empty__title">No buckets found</p>
                          </td>
                        </tr>
                      ) : (
                        lifecyclePagedRows.map((row) => (
                          <tr key={`${row.bucketName}-${row.accountId}`}>
                            <td>
                              {row.bucketName ? (
                                <button
                                  type="button"
                                  className="s3-lifecycle-table__bucket-btn"
                                  onClick={() => openBucketDetail(row.bucketName)}
                                  title={`Open ${row.bucketName} details`}
                                >
                                  {row.bucketName}
                                </button>
                              ) : (
                                "--"
                              )}
                            </td>
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
              </div>
            ) : null}
          </>
        ) : (
          <>
            {replicationQuery.isLoading ? <p className="dashboard-note">Loading S3 replication data...</p> : null}
            {showReplicationSlowHint ? (
              <p className="dashboard-note">
                Replication data is taking longer than expected. You can continue using other tabs while this loads.
              </p>
            ) : null}
            {replicationQuery.isError ? <p className="dashboard-note">Failed to load S3 replication data: {replicationQuery.error.message}</p> : null}
            {!replicationQuery.isLoading && !replicationQuery.isError ? (
              <>
                <div className="s3-replication-summary">
                  <div className="s3-replication-summary__item">
                    <span>Total Buckets</span>
                    <strong>{replicationSummary.total}</strong>
                  </div>
                  <div className="s3-replication-summary__item">
                    <span>Replication Configured</span>
                    <strong>{replicationSummary.present}</strong>
                  </div>
                  <div className="s3-replication-summary__item">
                    <span>Replication Missing</span>
                    <strong>{replicationSummary.absent}</strong>
                  </div>
                  <div className="s3-replication-summary__item">
                    <span>Permission Unknown</span>
                    <strong>{replicationSummary.unknown}</strong>
                  </div>
                </div>
                {replicationActionMessage ? (
                  <p className="s3-replication-action-message">
                    {replicationActionMessage}
                  </p>
                ) : null}
                <div className="s3-lifecycle-table-shell">
                <div className="optimization-rightsizing-table-scroll">
                  <table className="optimization-rightsizing-table s3-lifecycle-table s3-replication-table">
                    <thead>
                      <tr>
                        <th>Bucket</th>
                        <th>Replication Status</th>
                        <th>Rules Count</th>
                        <th>Destination Bucket</th>
                        <th>Destination Region</th>
                        <th>Replication Type</th>
                        <th>Status</th>
                        <th>Last Checked</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {replicationRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="optimization-rightsizing-empty">
                            <p className="optimization-rightsizing-empty__title">No buckets found</p>
                          </td>
                        </tr>
                      ) : (
                        replicationPagedRows.map((row) => (
                          <tr key={`${row.bucketName}-${row.accountId}`}>
                            <td>{row.bucketName || "--"}</td>
                            <td>
                              <span className={`s3-replication-status-pill ${toReplicationBadgeClass(row.replicationStatus)}`}>
                                {toStatusLabel(row.replicationStatus)}
                              </span>
                            </td>
                            <td>{row.rulesCount ?? 0}</td>
                            <td>{row.destinationBucket || "--"}</td>
                            <td>{row.destinationRegion || "--"}</td>
                            <td>{toStatusLabel(row.replicationType)}</td>
                            <td>{toStatusLabel(row.status)}</td>
                            <td>{formatScanTime(row.lastChecked)}</td>
                            <td>
                              <div className="s3-replication-actions">
                                {(row.actions ?? []).map((action: string) => (
                                  <button
                                    key={`${row.bucketName}-${action}`}
                                    type="button"
                                    className="optimization-rightsizing-view-btn"
                                    onClick={() => onReplicationAction(action, row.bucketName)}
                                  >
                                    {toReplicationActionLabel(action)}
                                  </button>
                                ))}
                              </div>
                              {row.recommendation ? (
                                <p className="s3-replication-recommendation">{row.recommendation}</p>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              </>
            ) : null}
          </>
        )}

        {activeTab !== "overview" && totalItems > 0 ? (
          <div className="policy-history-pagination">
            <div className="policy-history-pagination__left">
              <label className="policy-history-pagination__label" htmlFor="s3-lifecycle-page-size">
                Page Size:
              </label>
              <select
                id="s3-lifecycle-page-size"
                className="policy-history-pagination__size"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {[15, 30, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <p className="policy-history-pagination__meta">
              {startRow} to {endRow} of {totalItems}
            </p>
            <div className="policy-history-pagination__right">
              <span className="policy-history-pagination__page">
                Page {currentPage} of {totalPages}
              </span>
              <div className="policy-history-pagination__actions">
                <button type="button" className="optimization-rightsizing-view-btn" onClick={() => setCurrentPage(1)} disabled={currentPage <= 1}>
                  {"<<"}
                </button>
                <button
                  type="button"
                  className="optimization-rightsizing-view-btn"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                >
                  {"<"}
                </button>
                <button
                  type="button"
                  className="optimization-rightsizing-view-btn"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                >
                  {">"}
                </button>
                <button
                  type="button"
                  className="optimization-rightsizing-view-btn"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                >
                  {">>"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {showReplicationGuide ? (
        <div className="policy-history-modal-backdrop" role="presentation" onClick={() => setShowReplicationGuide(false)}>
          <div className="policy-history-modal s3-replication-guide" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="policy-history-modal__header">
              <h3>S3 Replication Setup Guide</h3>
              <button type="button" className="optimization-rightsizing-view-btn" onClick={() => setShowReplicationGuide(false)}>
                Close
              </button>
            </div>
            <p>Replication copies objects from source bucket to destination bucket for DR, backup, and compliance.</p>
            <h4>Required Before Setup</h4>
            <ul>
              <li>Enable versioning on source bucket</li>
              <li>Enable versioning on destination bucket</li>
              <li>Create or select replication IAM role</li>
              <li>Grant bucket permissions for replication</li>
            </ul>
            <h4>Phase-2 Setup Inputs</h4>
            <div className="s3-replication-setup-form">
              <label>
                Source Bucket
                <input value={setupForm.sourceBucketName} onChange={(e) => setSetupForm((prev) => ({ ...prev, sourceBucketName: e.target.value }))} />
              </label>
              <label>
                Destination Bucket
                <select
                  value={setupForm.destinationBucketName}
                  onChange={(e) => {
                    const selectedBucketName = e.target.value;
                    const selectedOption = (destinationBucketsQuery.data?.buckets ?? []).find(
                      (item) => item.bucketName === selectedBucketName,
                    );
                    setSetupForm((prev) => ({
                      ...prev,
                      destinationBucketName: selectedBucketName,
                      destinationRegion: selectedOption?.region ?? prev.destinationRegion,
                    }));
                  }}
                >
                  <option value="">
                    {destinationBucketsQuery.isLoading ? "Loading buckets..." : "Select destination bucket"}
                  </option>
                  {(destinationBucketsQuery.data?.buckets ?? []).map((bucket) => (
                    <option key={bucket.bucketName} value={bucket.bucketName}>
                      {bucket.bucketName}{bucket.region ? ` (${bucket.region})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {destinationBucketsQuery.isError ? (
                <p className="dashboard-note">{destinationBucketsQuery.error.message}</p>
              ) : null}
              <label>
                Destination Region
                <input value={setupForm.destinationRegion} onChange={(e) => setSetupForm((prev) => ({ ...prev, destinationRegion: e.target.value }))} />
              </label>
              <label>
                Replication Type
                <select value={setupForm.replicationType} onChange={(e) => setSetupForm((prev) => ({ ...prev, replicationType: e.target.value as "same_account" | "cross_account" }))}>
                  <option value="same_account">Same Account</option>
                  <option value="cross_account">Cross Account</option>
                </select>
              </label>
              {setupForm.replicationType === "cross_account" ? (
                <label>
                  Destination Account ID
                  <input value={setupForm.destinationAccountId} onChange={(e) => setSetupForm((prev) => ({ ...prev, destinationAccountId: e.target.value }))} />
                </label>
              ) : null}
              <label>
                Replication Role ARN
                <input
                  value={setupForm.replicationRoleArn}
                  placeholder="Auto-generated after source and destination bucket selection"
                  readOnly
                />
              </label>
              {autoCreateRoleMutation.isPending ? <p className="dashboard-note">Generating replication role ARN...</p> : null}
              {autoCreateRoleMutation.error ? <p className="dashboard-note">{autoCreateRoleMutation.error.message}</p> : null}
              <div className="s3-replication-setup-actions">
                <button
                  type="button"
                  className="optimization-rightsizing-view-btn"
                  onClick={() => {
                    const sourceBucketName = String(setupForm.sourceBucketName ?? "").trim();
                    const destinationBucketName = String(setupForm.destinationBucketName ?? "").trim();
                    if (!sourceBucketName || !destinationBucketName) return;
                    lastAutoRoleKeyRef.current = "";
                    void autoCreateRoleMutation
                      .mutateAsync({ sourceBucketName, destinationBucketName })
                      .then((result) => {
                        setSetupForm((prev) => ({ ...prev, replicationRoleArn: result.roleArn }));
                      });
                  }}
                  disabled={
                    autoCreateRoleMutation.isPending ||
                    !String(setupForm.sourceBucketName ?? "").trim() ||
                    !String(setupForm.destinationBucketName ?? "").trim()
                  }
                >
                  {autoCreateRoleMutation.isPending ? "Generating Role..." : "Generate Role ARN"}
                </button>
              </div>
              <label>
                Rule Name
                <input value={setupForm.ruleName} onChange={(e) => setSetupForm((prev) => ({ ...prev, ruleName: e.target.value }))} />
              </label>
              <label>
                Prefix (Optional)
                <input value={setupForm.prefix} onChange={(e) => setSetupForm((prev) => ({ ...prev, prefix: e.target.value }))} />
              </label>
              <div className="s3-replication-setup-actions">
                <button
                  type="button"
                  className="optimization-rightsizing-view-btn"
                  onClick={() => {
                    void previewMutation.mutateAsync({
                      ...setupForm,
                      destinationAccountId: setupForm.destinationAccountId || null,
                      prefix: setupForm.prefix || null,
                    });
                  }}
                  disabled={previewMutation.isPending}
                >
                  {previewMutation.isPending ? "Checking..." : "Check Readiness"}
                </button>
                <button
                  type="button"
                  className="optimization-rightsizing-view-btn"
                  onClick={() => {
                    void applyMutation.mutateAsync({
                      ...setupForm,
                      destinationAccountId: setupForm.destinationAccountId || null,
                      prefix: setupForm.prefix || null,
                    });
                  }}
                  disabled={applyMutation.isPending}
                >
                  {applyMutation.isPending ? "Applying..." : "Apply Replication"}
                </button>
              </div>
            </div>
            {previewMutation.data ? (
              <div className="s3-replication-preview-results">
                <p>{previewMutation.data.message}</p>
                <ul>
                  {previewMutation.data.checks.map((check) => (
                    <li key={check.key}>
                      <strong>{check.title}:</strong> {check.status.toUpperCase()} - {check.detail}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {previewMutation.error ? <p className="dashboard-note">{previewMutation.error.message}</p> : null}
            {applyMutation.data ? <p className="dashboard-note">{applyMutation.data.message}</p> : null}
            {applyMutation.error ? <p className="dashboard-note">{applyMutation.error.message}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
