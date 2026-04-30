import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePolicyActionHistoryQuery } from "../../hooks/useDashboardQueries";

export default function PolicyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isServiceMenuOpen, setIsServiceMenuOpen] = useState(false);
  const policyHistoryQuery = usePolicyActionHistoryQuery();

  const handleCreatePolicy = () => {
    setIsServiceMenuOpen((prev) => !prev);
  };

  const handleSelectS3 = () => {
    navigate({
      pathname: "/dashboard/policy/s3",
      search: location.search,
    });
    setIsServiceMenuOpen(false);
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
        {policyHistoryQuery.isLoading ? <p className="dashboard-note">Loading policy history...</p> : null}
        {policyHistoryQuery.isError ? <p className="dashboard-note">Failed to load policy history: {policyHistoryQuery.error.message}</p> : null}
        {!policyHistoryQuery.isLoading && !policyHistoryQuery.isError ? (
          <div className="optimization-rightsizing-table-scroll">
            <table className="optimization-rightsizing-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Policy Type</th>
                  <th>Bucket</th>
                  <th>Rule</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>Account</th>
                  <th>Region</th>
                  <th>Created At</th>
                  <th>Created By</th>
                </tr>
              </thead>
              <tbody>
                {(policyHistoryQuery.data?.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={10} className="optimization-rightsizing-empty">
                      <p className="optimization-rightsizing-empty__title">No policy actions found</p>
                    </td>
                  </tr>
                ) : (
                  (policyHistoryQuery.data?.items ?? []).map((item) => (
                    <tr key={item.id}>
                      <td>{item.serviceName}</td>
                      <td>{item.policyType}</td>
                      <td>{item.bucketName || "--"}</td>
                      <td>{item.ruleName || "--"}</td>
                      <td>{item.scopeType === "prefix" ? `prefix:${item.scopePrefix ?? "--"}` : "entire_bucket"}</td>
                      <td>{item.status}</td>
                      <td>{item.accountId || "--"}</td>
                      <td>{item.region || "--"}</td>
                      <td>
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "2-digit",
                            })
                          : "--"}
                      </td>
                      <td>{item.createdByUserId || "--"}</td>
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
