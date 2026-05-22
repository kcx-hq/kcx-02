import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useDeleteS3LifecyclePolicyMutation, usePolicyActionHistoryQuery } from "../../hooks/useDashboardQueries";
import { getAuthUser } from "@/lib/auth";
import type { S3PolicyActionHistoryItem } from "../../api/dashboardTypes";

function formatCreatedByLabel(createdByUserId: string | null, currentUserId: string | null, currentUserName: string): string {
  if (!createdByUserId) return "System";
  if (currentUserId && createdByUserId === currentUserId) {
    return currentUserName ? `You (${currentUserName})` : "You";
  }

  const compact = createdByUserId.trim();
  if (compact.length <= 16) return compact;
  return `${compact.slice(0, 8)}...${compact.slice(-4)}`;
}

function PolicyHistorySkeleton() {
  return (
    <div className="policy-history-shell policy-history-skeleton" aria-label="Loading policy history">
      <div className="optimization-rightsizing-table-scroll">
        <div className="policy-history-skeleton__table" aria-hidden="true">
          <div className="policy-history-skeleton__head">
            {Array.from({ length: 10 }).map((_, index) => (
              <span key={`policy-skeleton-head-${index}`} className="policy-history-skeleton__cell policy-history-skeleton__cell--head" />
            ))}
          </div>
          <div className="policy-history-skeleton__body">
            {Array.from({ length: 8 }).map((_, rowIndex) => (
              <div key={`policy-skeleton-row-${rowIndex}`} className="policy-history-skeleton__row">
                {Array.from({ length: 10 }).map((_, colIndex) => (
                  <span key={`policy-skeleton-cell-${rowIndex}-${colIndex}`} className="policy-history-skeleton__cell policy-history-skeleton__cell--body" />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="policy-history-skeleton__scroll" />
      </div>
      <div className="policy-history-skeleton__pagination" aria-hidden="true">
        <span className="policy-history-skeleton__cell policy-history-skeleton__cell--pagination-sm" />
        <span className="policy-history-skeleton__cell policy-history-skeleton__cell--pagination-md" />
        <span className="policy-history-skeleton__cell policy-history-skeleton__cell--pagination-sm" />
      </div>
    </div>
  );
}

export default function PolicyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isServiceMenuOpen, setIsServiceMenuOpen] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewItem, setViewItem] = useState<S3PolicyActionHistoryItem | null>(null);
  const policyHistoryQuery = usePolicyActionHistoryQuery();
  const deleteMutation = useDeleteS3LifecyclePolicyMutation();
  const authUser = getAuthUser();
  const currentUserId = authUser?.id != null ? String(authUser.id) : null;
  const currentUserName = [authUser?.firstName, authUser?.lastName].filter(Boolean).join(" ").trim();
  const allItems = policyHistoryQuery.data?.items ?? [];

  const totalItems = allItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, totalItems]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allItems.slice(start, start + pageSize);
  }, [allItems, currentPage, pageSize]);

  const startRow = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, totalItems);

  const handleCreatePolicy = () => {
    setIsServiceMenuOpen((prev) => !prev);
  };

  const handleSelectS3 = () => {
    navigate({
      pathname: "/dashboard/policy/lifecycle",
      search: location.search,
    });
    setIsServiceMenuOpen(false);
  };

  const handleEdit = (item: S3PolicyActionHistoryItem) => {
    navigate({
      pathname: "/dashboard/policy/lifecycle",
      search: `${location.search ? `${location.search}&` : "?"}bucketName=${encodeURIComponent(item.bucketName)}&ruleName=${encodeURIComponent(item.ruleName ?? "")}`,
    });
  };

  const handleDelete = async (item: S3PolicyActionHistoryItem) => {
    if (!item.bucketName || !item.ruleName) return;
    const confirmed = window.confirm(`Delete lifecycle rule "${item.ruleName}" from bucket "${item.bucketName}"?`);
    if (!confirmed) return;
    await deleteMutation.mutateAsync({
      bucketName: item.bucketName,
      ruleName: item.ruleName,
      accountId: item.accountId,
      region: item.region,
    });
  };

  return (
    <div className="dashboard-page optimization-page">
      <div className="cost-explorer-widget-shell">
        <header className="cost-explorer-widget-shell__header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2>Policy</h2>
          <div style={{ position: "relative" }}>
            <button type="button" className="cost-explorer-state-btn" onClick={handleCreatePolicy} aria-expanded={isServiceMenuOpen}>
              Create Policy
            </button>
            {isServiceMenuOpen ? (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  display: "grid",
                  gap: "6px",
                  minWidth: "160px",
                  padding: "8px",
                  border: "1px solid rgba(47, 86, 77, 0.22)",
                  borderRadius: "8px",
                  background: "#f8fbfa",
                  zIndex: 20,
                }}
              >
                <button type="button" className="cost-explorer-state-btn" disabled>
                  EC2
                </button>
                <button type="button" className="cost-explorer-state-btn" onClick={handleSelectS3}>
                  S3
                </button>
                <button type="button" className="cost-explorer-state-btn" disabled>
                  RDS
                </button>
              </div>
            ) : null}
          </div>
        </header>
        {policyHistoryQuery.isLoading ? <PolicyHistorySkeleton /> : null}
        {policyHistoryQuery.isError ? <p className="dashboard-note">Failed to load policy history: {policyHistoryQuery.error.message}</p> : null}
        {!policyHistoryQuery.isLoading && !policyHistoryQuery.isError ? (
          <div className="policy-history-shell">
            <div className="optimization-rightsizing-table-scroll">
              <table className="optimization-rightsizing-table policy-history-table">
                <thead>
                  <tr>
                    <th>Created By</th>
                    <th>Service</th>
                    <th>Policy Type</th>
                    <th>Bucket</th>
                    <th>Rule</th>
                    <th>Scope</th>
                    <th>Status</th>
                    <th>Region</th>
                    <th>Created At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {totalItems === 0 ? (
                    <tr>
                      <td colSpan={10} className="optimization-rightsizing-empty">
                        <p className="optimization-rightsizing-empty__title">No policy actions found</p>
                        <p className="optimization-rightsizing-empty__text">Create a policy from the button above to see action history here.</p>
                      </td>
                    </tr>
                  ) : (
                    pagedItems.map((item) => (
                      <tr key={item.id}>
                        <td title={item.createdByUserId ?? "System"}>
                          {formatCreatedByLabel(item.createdByUserId, currentUserId, currentUserName)}
                        </td>
                        <td>{item.serviceName}</td>
                        <td>{item.policyType}</td>
                        <td>{item.bucketName || "--"}</td>
                        <td>{item.ruleName || "--"}</td>
                        <td>{item.scopeType === "prefix" ? `prefix:${item.scopePrefix ?? "--"}` : "entire_bucket"}</td>
                        <td>
                          <span className={`optimization-rightsizing-pill is-status-${item.status}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>{item.region || "--"}</td>
                        <td>
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "--"}
                        </td>
                        <td>
                          <div className="policy-history-actions">
                            <button type="button" className="policy-history-action-btn" onClick={() => setViewItem(item)} title="View policy payload">
                              <Eye size={14} />
                            </button>
                            <button type="button" className="policy-history-action-btn" onClick={() => handleEdit(item)} title="Edit policy">
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="policy-history-action-btn policy-history-action-btn--danger"
                              onClick={() => void handleDelete(item)}
                              title="Delete policy"
                              disabled={deleteMutation.isPending || !item.ruleName}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalItems > 0 ? (
              <div className="policy-history-pagination">
                <div className="policy-history-pagination__left">
                  <label className="policy-history-pagination__label" htmlFor="policy-history-page-size">
                    Page Size:
                  </label>
                  <select
                    id="policy-history-page-size"
                    className="policy-history-pagination__size"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    {[10, 20, 50].map((size) => (
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
                    <button
                      type="button"
                      className="optimization-rightsizing-view-btn"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage <= 1}
                    >
                      First
                    </button>
                    <button
                      type="button"
                      className="optimization-rightsizing-view-btn"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage <= 1}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className="optimization-rightsizing-view-btn"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      Next
                    </button>
                    <button
                      type="button"
                      className="optimization-rightsizing-view-btn"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage >= totalPages}
                    >
                      Last
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {viewItem ? (
        <div className="policy-history-modal-backdrop" role="presentation" onClick={() => setViewItem(null)}>
          <div className="policy-history-modal" role="dialog" aria-modal="true" aria-label="Policy details" onClick={(e) => e.stopPropagation()}>
            <div className="policy-history-modal__header">
              <h3>Policy Payload</h3>
              <button type="button" className="policy-history-action-btn" onClick={() => setViewItem(null)}>Close</button>
            </div>
            <p><strong>Bucket:</strong> {viewItem.bucketName || "--"}</p>
            <p><strong>Rule:</strong> {viewItem.ruleName || "--"}</p>
            <p><strong>Status:</strong> {viewItem.status}</p>
            <p><strong>Request:</strong></p>
            <pre>{JSON.stringify(viewItem.requestPayloadJson ?? {}, null, 2)}</pre>
            <p><strong>Response:</strong></p>
            <pre>{JSON.stringify(viewItem.responsePayloadJson ?? {}, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
