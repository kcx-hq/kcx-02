import type { ColDef } from "ag-grid-community";
import { useMemo } from "react";

import type { DatabaseAssetDetail } from "../../../api/dashboardTypes";
import { WidgetShell } from "../../../common/components";
import { BaseDataTable } from "../../../common/tables/BaseDataTable";
import {
  DETAIL_EMPTY_NOTE,
  displayValue,
  formatDateOnly,
  formatDateTime,
} from "./database-asset-detail.formatters";

type DatabaseAssetDetailMetadataSectionProps = {
  detail: DatabaseAssetDetail;
};

type MetadataRow = {
  key: string;
  value: string;
};

export function DatabaseAssetDetailMetadataSection({ detail }: DatabaseAssetDetailMetadataSectionProps) {
  const tagRows = useMemo<MetadataRow[]>(
    () =>
      Object.entries(detail.metadata.tags ?? {}).map(([key, value]) => ({
        key,
        value: typeof value === "string" ? value : JSON.stringify(value) ?? String(value),
      })),
    [detail.metadata.tags],
  );

  const rawMetadataRows = useMemo<MetadataRow[]>(
    () =>
      Object.entries(detail.metadata.rawMetadata ?? {}).map(([key, value]) => ({
        key,
        value: typeof value === "string" ? value : JSON.stringify(value) ?? String(value),
      })),
    [detail.metadata.rawMetadata],
  );

  const columnDefs = useMemo<ColDef<MetadataRow>[]>(
    () => [
      { headerName: "Key", field: "key", minWidth: 180 },
      { headerName: "Value", field: "value", minWidth: 260 },
    ],
    [],
  );

  return (
    <div className="database-asset-detail__stack">
      <WidgetShell title="Metadata" subtitle="Raw identity and traceability attributes">
        <div className="database-asset-detail__meta-grid">
          <div>
            <span>Resource ID</span>
            <strong>{detail.identity.resourceId}</strong>
          </div>
          <div>
            <span>Resource ARN</span>
            <strong>{displayValue(detail.identity.resourceArn)}</strong>
          </div>
          <div>
            <span>Cloud Connection ID</span>
            <strong>{detail.identity.cloudConnectionId}</strong>
          </div>
          <div>
            <span>Latest Usage Date</span>
            <strong>{formatDateOnly(detail.identity.latestUsageDate)}</strong>
          </div>
          <div>
            <span>Discovered Date</span>
            <strong>{formatDateTime(detail.identity.discoveredAt)}</strong>
          </div>
          <div>
            <span>Engine Version</span>
            <strong>{displayValue(detail.identity.dbEngineVersion)}</strong>
          </div>
          <div>
            <span>Capacity Mode</span>
            <strong>{displayValue(detail.identity.capacityMode)}</strong>
          </div>
          <div>
            <span>Resource Name</span>
            <strong>{displayValue(detail.identity.resourceName)}</strong>
          </div>
        </div>
      </WidgetShell>

      <WidgetShell title="Tags" subtitle="Inventory tags captured for this resource">
        <BaseDataTable columnDefs={columnDefs} rowData={tagRows} autoHeight emptyMessage={DETAIL_EMPTY_NOTE} />
      </WidgetShell>

      <WidgetShell title="Raw Metadata" subtitle="Inventory metadata captured for this resource">
        <BaseDataTable columnDefs={columnDefs} rowData={rawMetadataRows} autoHeight emptyMessage={DETAIL_EMPTY_NOTE} />
      </WidgetShell>
    </div>
  );
}
