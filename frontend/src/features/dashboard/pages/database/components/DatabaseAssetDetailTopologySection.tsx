import type { DatabaseAssetDetail } from "../../../api/dashboardTypes";
import { WidgetShell } from "../../../common/components";
import {
  DETAIL_EMPTY_NOTE,
  displayValue,
  formatNumber,
  toTitleCase,
} from "./database-asset-detail.formatters";

type DatabaseAssetDetailTopologySectionProps = {
  detail: DatabaseAssetDetail;
};

export function DatabaseAssetDetailTopologySection({ detail }: DatabaseAssetDetailTopologySectionProps) {
  return (
    <WidgetShell title="Topology & Placement" subtitle="Cluster membership and account placement details">
      <div className="database-asset-detail__meta-grid">
        <div>
          <span>Cluster ID</span>
          <strong>{displayValue(detail.topology.clusterId)}</strong>
        </div>
        <div>
          <span>Placement</span>
          <strong>{detail.topology.isClusterResource ? "Cluster resource" : "Standalone resource"}</strong>
        </div>
        <div>
          <span>Related Resource Count</span>
          <strong>{formatNumber(detail.topology.relatedResourceCount)}</strong>
        </div>
        <div>
          <span>Resource Type</span>
          <strong>{displayValue(detail.topology.resourceType)}</strong>
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
          <span>DB Service</span>
          <strong>{displayValue(detail.identity.dbService)}</strong>
        </div>
      </div>
      <p className="dashboard-note">
        Replica roles, failover state, and AZ topology are {DETAIL_EMPTY_NOTE.toLowerCase()}.
      </p>
    </WidgetShell>
  );
}
