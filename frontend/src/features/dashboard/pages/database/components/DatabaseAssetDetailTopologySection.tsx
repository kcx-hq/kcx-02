import type { DatabaseAssetDetail } from "../../../api/dashboardTypes";
import { WidgetShell } from "../../../common/components";
import {
  displayValue,
  formatNumber,
} from "./database-asset-detail.formatters";

type DatabaseAssetDetailTopologySectionProps = {
  detail: DatabaseAssetDetail;
};

export function DatabaseAssetDetailTopologySection({ detail }: DatabaseAssetDetailTopologySectionProps) {
  const hasClusterId = Boolean(detail.topology.clusterId && detail.topology.clusterId.trim().length > 0);
  const relatedCount = detail.topology.relatedResourceCount;
  const hasRelatedCount = relatedCount !== null && typeof relatedCount !== "undefined" && Number.isFinite(relatedCount);
  const hasMeaningfulTopology = hasClusterId || detail.topology.isClusterResource || (hasRelatedCount && Number(relatedCount) > 1);

  if (!hasMeaningfulTopology) {
    return (
      <WidgetShell title="Topology & Placement" subtitle="Cluster membership and account placement details">
        <p className="dashboard-note">No cluster topology data is available for this resource.</p>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell title="Topology & Placement" subtitle="Cluster membership and account placement details">
      <div className="database-asset-detail__meta-grid">
        {hasClusterId ? (
          <div>
            <span>Cluster ID</span>
            <strong>{displayValue(detail.topology.clusterId)}</strong>
          </div>
        ) : null}
        <div>
          <span>Cluster Membership</span>
          <strong>{detail.topology.isClusterResource ? "Cluster resource" : "Standalone resource"}</strong>
        </div>
        {hasRelatedCount ? (
          <div>
            <span>Related Resource Count</span>
            <strong>{formatNumber(detail.topology.relatedResourceCount)}</strong>
          </div>
        ) : null}
        <div>
          <span>Resource Type</span>
          <strong>{displayValue(detail.topology.resourceType)}</strong>
        </div>
      </div>
    </WidgetShell>
  );
}
