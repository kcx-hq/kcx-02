import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { EmptyStateBlock, WidgetShell } from "../../common/components";
import { useDatabaseAssetDetailQuery } from "../../hooks/useDashboardQueries";
import {
  DatabaseAssetDetailHeaderTabs,
  type DatabaseAssetDetailTabKey,
} from "./components/DatabaseAssetDetailHeaderTabs";
import { DatabaseAssetDetailSummary } from "./components/DatabaseAssetDetailSummary";
import { DatabaseAssetDetailCostSection } from "./components/DatabaseAssetDetailCostSection";
import { DatabaseAssetDetailUsageSection } from "./components/DatabaseAssetDetailUsageSection";
import { DatabaseAssetDetailStorageSection } from "./components/DatabaseAssetDetailStorageSection";
import { DatabaseAssetDetailPerformanceSection } from "./components/DatabaseAssetDetailPerformanceSection";
import { DatabaseAssetDetailTopologySection } from "./components/DatabaseAssetDetailTopologySection";
import { DatabaseAssetDetailMetadataSection } from "./components/DatabaseAssetDetailMetadataSection";
import {
  DETAIL_EMPTY_NOTE,
  displayValue,
  formatDateRange,
  getActivitySignal,
  getResourceFootprint,
  toTitleCase,
} from "./components/database-asset-detail.formatters";

const ASSETS_PAGE_PATH = "/dashboard/services/database/assets";

const firstNonEmpty = (...values: Array<string | null>): string | null => {
  for (const value of values) {
    if (value && value.trim().length > 0) return value;
  }
  return null;
};

export default function DatabaseAssetDetailPage() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DatabaseAssetDetailTabKey>("overview");

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const cloudConnectionId = firstNonEmpty(
    queryParams.get("cloud_connection_id"),
    queryParams.get("cloudConnectionId"),
  );
  const startDate = firstNonEmpty(
    queryParams.get("start_date"),
    queryParams.get("startDate"),
    queryParams.get("from"),
  );
  const endDate = firstNonEmpty(
    queryParams.get("end_date"),
    queryParams.get("endDate"),
    queryParams.get("to"),
  );

  const detailQuery = useDatabaseAssetDetailQuery(resourceId ?? null, {
    cloudConnectionId,
    startDate,
    endDate,
  });

  const backToAssets = () => {
    const next = new URLSearchParams(location.search);
    next.delete("resourceId");
    navigate({ pathname: ASSETS_PAGE_PATH, search: next.toString() });
  };

  if (!resourceId || !cloudConnectionId || !startDate || !endDate) {
    return (
      <div className="dashboard-page">
        <EmptyStateBlock
          title="Missing database detail context"
          message="Resource ID, cloud connection, and date range are required to load this database detail page."
          actions={
            <button type="button" className="cost-explorer-state-btn" onClick={backToAssets}>
              Back to Assets
            </button>
          }
        />
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="dashboard-note">Loading database asset details...</p>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="dashboard-page">
        <EmptyStateBlock
          title="Unable to load database asset details"
          message={detailQuery.isError ? detailQuery.error.message : "Database asset detail not found for the selected range."}
          actions={
            <button type="button" className="cost-explorer-state-btn" onClick={backToAssets}>
              Back to Assets
            </button>
          }
        />
      </div>
    );
  }

  const detail = detailQuery.data;

  return (
    <div className="dashboard-page database-asset-detail-page">
      <section className="database-asset-detail">
        <div className="database-asset-detail__header">
          <div>
            <p className="database-asset-detail__eyebrow">Database Asset Detail</p>
            <h1 className="database-asset-detail__title">
              {displayValue(detail.identity.dbIdentifier ?? detail.identity.resourceName)}
            </h1>
            <p className="database-asset-detail__subtitle">
              {[
                detail.identity.dbService,
                detail.identity.dbEngine,
                detail.identity.resourceType,
                detail.identity.regionName,
                detail.identity.subAccountName,
              ]
                .filter((value): value is string => Boolean(value && value.trim().length > 0))
                .join(" • ") || DETAIL_EMPTY_NOTE}
            </p>
          </div>
          <div className="database-asset-detail__header-actions">
            <div className="database-asset-detail__range-chip">{formatDateRange(startDate, endDate)}</div>
            <button type="button" className="cost-explorer-state-btn" onClick={backToAssets}>
              Back to Assets
            </button>
          </div>
        </div>

        <WidgetShell title="Identity" subtitle="Core resource identity for the selected date range">
          <div className="database-asset-detail__meta-grid">
            <div>
              <span>DB Identifier</span>
              <strong>{displayValue(detail.identity.dbIdentifier)}</strong>
            </div>
            <div>
              <span>Service</span>
              <strong>{displayValue(detail.identity.dbService)}</strong>
            </div>
            <div>
              <span>Engine</span>
              <strong>{displayValue(detail.identity.dbEngine)}</strong>
            </div>
            <div>
              <span>Resource Type</span>
              <strong>{displayValue(detail.identity.resourceType)}</strong>
            </div>
            <div>
              <span>Region</span>
              <strong>{displayValue(detail.identity.regionName ?? detail.identity.regionKey)}</strong>
            </div>
            <div>
              <span>Account / Sub-account</span>
              <strong>{displayValue(detail.identity.subAccountName ?? detail.identity.subAccountKey)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{toTitleCase(detail.identity.status)}</strong>
            </div>
            <div>
              <span>Date Range</span>
              <strong>{formatDateRange(startDate, endDate)}</strong>
            </div>
          </div>
        </WidgetShell>

        <DatabaseAssetDetailHeaderTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "overview" ? (
          <div className="database-asset-detail__stack">
            <DatabaseAssetDetailSummary detail={detail} />
            <WidgetShell title="Executive Summary" subtitle="Immediate context for this database asset">
              <div className="database-asset-detail__summary-grid database-asset-detail__summary-grid--text">
                <div className="database-asset-detail__summary-card">
                  <span>Primary Cost Driver</span>
                  <strong>{detail.costSummary.primaryCostDriver ?? DETAIL_EMPTY_NOTE}</strong>
                </div>
                <div className="database-asset-detail__summary-card">
                  <span>Activity Signal</span>
                  <strong>
                    {getActivitySignal({
                      avgLoad: detail.usageSummary.avgLoad,
                      avgCpu: detail.usageSummary.avgCpu,
                      avgConnections: detail.usageSummary.avgConnections,
                      requestCount: detail.usageSummary.requestCount,
                    })}
                  </strong>
                </div>
                <div className="database-asset-detail__summary-card">
                  <span>Resource Footprint</span>
                  <strong>
                    {getResourceFootprint({
                      allocatedStorageGb: detail.storageSummary.allocatedStorageGb,
                      dataFootprintGb: detail.storageSummary.dataFootprintGb,
                      instanceClass: detail.identity.instanceClass,
                      resourceType: detail.identity.resourceType,
                    })}
                  </strong>
                </div>
              </div>
            </WidgetShell>
          </div>
        ) : null}

        {activeTab === "cost" ? <DatabaseAssetDetailCostSection detail={detail} /> : null}
        {activeTab === "usage" ? <DatabaseAssetDetailUsageSection detail={detail} /> : null}
        {activeTab === "storage" ? <DatabaseAssetDetailStorageSection detail={detail} /> : null}
        {activeTab === "performance" ? <DatabaseAssetDetailPerformanceSection detail={detail} /> : null}
        {activeTab === "topology" ? <DatabaseAssetDetailTopologySection detail={detail} /> : null}
        {activeTab === "metadata" ? <DatabaseAssetDetailMetadataSection detail={detail} /> : null}
      </section>
    </div>
  );
}
