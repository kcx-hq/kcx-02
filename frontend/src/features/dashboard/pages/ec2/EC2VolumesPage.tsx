import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useInventoryEc2Volumes } from "@/features/client-home/hooks/useInventoryEc2Volumes";

import { useDashboardScope } from "../../hooks/useDashboardScope";
import { EC2_EXPLORER_DEFAULT_CONTROLS, EC2ExplorerTable, EC2SummaryCards } from "./components";

const parseNumberOrNull = (value: string): number | null => {
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const defaultSummary = {
  totalCost: 0,
  previousCost: 0,
  trendPercent: 0,
  instanceCount: 0,
  volumeCount: 0,
  attachedInstanceCount: 0,
  unattachedVolumeCount: 0,
  storageGb: 0,
  storageGbHours: 0,
  avgCpu: 0,
  totalNetworkGb: 0,
};

const VOLUME_DETAIL_BASE_PATH = "/dashboard/inventory/aws/ec2/volumes";

const matchesSizeBucket = (sizeGb: number | null, bucket: string): boolean => {
  if (bucket === "all") return true;
  const value = typeof sizeGb === "number" && Number.isFinite(sizeGb) ? sizeGb : null;
  if (value === null) return false;
  if (bucket === "0-100 GB") return value >= 0 && value <= 100;
  if (bucket === "101-500 GB") return value >= 101 && value <= 500;
  if (bucket === "501 GB-1 TB") return value >= 501 && value <= 1024;
  if (bucket === "1 TB+") return value > 1024;
  return true;
};

export default function EC2VolumesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { scope } = useDashboardScope();
  const scopeParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const scopeStartDate =
    scope?.from ??
    scopeParams.get("from") ??
    scopeParams.get("billingPeriodStart") ??
    scopeParams.get("startDate") ??
    undefined;
  const scopeEndDate =
    scope?.to ??
    scopeParams.get("to") ??
    scopeParams.get("billingPeriodEnd") ??
    scopeParams.get("endDate") ??
    undefined;

  const [controls] = useState({
    ...EC2_EXPLORER_DEFAULT_CONTROLS,
    metric: "volumes",
    groupBy: "none" as const,
  });
  const [attachmentState, setAttachmentState] = useState<"all" | "attached" | "unattached">("all");
  const [volumeType, setVolumeType] = useState<string>("all");
  const [sizeBucket, setSizeBucket] = useState<string>("all");
  const [search, setSearch] = useState("");

  const volumeFilters = useMemo(
    () => ({
      page: 1,
      pageSize: 500,
      sortBy: "signal" as const,
      sortDirection: "desc" as const,
      attachmentState: attachmentState === "all" ? null : attachmentState,
      volumeType: volumeType === "all" ? null : volumeType,
      search: search.trim().length > 0 ? search.trim() : null,
      startDate: scopeStartDate ?? null,
      endDate: scopeEndDate ?? null,
      minCost: parseNumberOrNull(controls.thresholds.costMin),
      maxCost: parseNumberOrNull(controls.thresholds.costMax),
      minCpu: parseNumberOrNull(controls.thresholds.cpuMin),
      maxCpu: parseNumberOrNull(controls.thresholds.cpuMax),
      minNetwork: parseNumberOrNull(controls.thresholds.networkMin),
      maxNetwork: parseNumberOrNull(controls.thresholds.networkMax),
    }),
    [attachmentState, controls, scopeEndDate, scopeStartDate, search, volumeType],
  );
  const volumesQuery = useInventoryEc2Volumes({
    attachmentState: volumeFilters.attachmentState,
    volumeType: volumeFilters.volumeType,
    search: volumeFilters.search,
    startDate: volumeFilters.startDate,
    endDate: volumeFilters.endDate,
    page: volumeFilters.page,
    pageSize: volumeFilters.pageSize,
    sortBy: volumeFilters.sortBy,
    sortDirection: volumeFilters.sortDirection,
  });
  const rows = useMemo(
    () =>
      (volumesQuery.data?.items ?? [])
        .filter((item) => item.volumeId.trim().length > 0 && item.volumeId.toLowerCase() !== "unknown")
        .filter((item) => item.mtdCost >= 0 && item.storageCost >= 0)
        .filter((item) => matchesSizeBucket(item.sizeGb, sizeBucket)),
    [sizeBucket, volumesQuery.data?.items],
  );

  const summary = useMemo(() => {
    const volumeCount = rows.length;
    const unattachedVolumeCount = rows.filter((row) => row.isAttached === false || row.isUnattached === true).length;
    const storageGb = rows.reduce((sum, row) => sum + (row.sizeGb ?? 0), 0);
    const totalCost = rows.reduce((sum, row) => sum + row.mtdCost, 0);
    return {
      ...defaultSummary,
      volumeCount,
      unattachedVolumeCount,
      storageGb,
      totalCost,
    };
  }, [rows]);

  const table = useMemo(
    () => ({
      columns: [
        { key: "volumeId", label: "Volume" },
        { key: "cost", label: "Cost" },
        { key: "size", label: "Size" },
        { key: "volumeType", label: "Type" },
        { key: "state", label: "State" },
        { key: "attachment", label: "Attachment" },
        { key: "attachedInstance", label: "Attached Instance" },
        { key: "status", label: "Status" },
        { key: "snapshotCount", label: "Snapshot Count" },
        { key: "iops", label: "IOPS" },
        { key: "throughput", label: "Throughput" },
        { key: "region", label: "Region" },
      ],
      rows: rows.map((item) => ({
        id: item.volumeId,
        volumeId: item.volumeName || item.volumeId,
        cost: item.mtdCost,
        size: item.sizeGb ?? 0,
        volumeType: item.volumeType ?? "-",
        state: item.state ?? "-",
        attachment: item.isAttached ? "Attached" : "Unattached",
        attachedInstance: item.isAttached
          ? item.attachedInstanceName || item.attachedInstanceId || "-"
          : "-",
        status: item.statusLabel ?? item.optimizationStatus ?? "Healthy",
        snapshotCount: item.snapshotCount ?? 0,
        iops: item.iops ?? 0,
        throughput: item.throughput ?? 0,
        region: item.regionName || item.regionId || "-",
      })),
    }),
    [rows],
  );

  const isSectionLoading = volumesQuery.isLoading || volumesQuery.isFetching;

  return (
    <div className="dashboard-page cost-explorer-page ec2-explorer-page">
      <section className="ec2-explorer-head-stack" aria-label="EC2 volumes inventory filters and summary">
        <section className="cost-explorer-control-surface ec2-explorer-controls" aria-label="EC2 volumes filters">
          <div className="cost-explorer-toolbar-row ec2-explorer-toolbar-row--primary">
            <div className="ec2-instances-toolbar-main">
              <div className="cost-explorer-toolbar-item">
                <label className="cost-explorer-toolbar-trigger">
                  <span className="cost-explorer-toolbar-trigger__label">Attachment State</span>
                  <select className="ec2-instances-search-trigger__input" value={attachmentState} onChange={(event) => setAttachmentState(event.target.value as "all" | "attached" | "unattached")}>
                    <option value="all">All</option>
                    <option value="attached">Attached</option>
                    <option value="unattached">Unattached</option>
                  </select>
                </label>
              </div>

              <div className="cost-explorer-toolbar-item">
                <label className="cost-explorer-toolbar-trigger">
                  <span className="cost-explorer-toolbar-trigger__label">Volume Type</span>
                  <select className="ec2-instances-search-trigger__input" value={volumeType} onChange={(event) => setVolumeType(event.target.value)}>
                    <option value="all">All</option>
                    <option value="gp2">gp2</option>
                    <option value="gp3">gp3</option>
                    <option value="io1">io1</option>
                    <option value="io2">io2</option>
                    <option value="st1">st1</option>
                    <option value="sc1">sc1</option>
                  </select>
                </label>
              </div>

              <div className="cost-explorer-toolbar-item">
                <label className="cost-explorer-toolbar-trigger">
                  <span className="cost-explorer-toolbar-trigger__label">Size Bucket</span>
                  <select className="ec2-instances-search-trigger__input" value={sizeBucket} onChange={(event) => setSizeBucket(event.target.value)}>
                    <option value="all">All</option>
                    <option value="0-100 GB">0-100 GB</option>
                    <option value="101-500 GB">101-500 GB</option>
                    <option value="501 GB-1 TB">501 GB-1 TB</option>
                    <option value="1 TB+">1 TB+</option>
                  </select>
                </label>
              </div>

              <div className="cost-explorer-toolbar-item">
                <label className="cost-explorer-toolbar-trigger ec2-instances-search-trigger">
                  <span className="ec2-instances-search-trigger__icon-wrap" aria-hidden="true">
                    <Search size={14} />
                  </span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search volume or instance"
                    aria-label="Search volumes"
                    className="ec2-instances-search-trigger__input"
                  />
                </label>
              </div>

            </div>
          </div>
        </section>

        <EC2SummaryCards summary={summary} loading={isSectionLoading} metric="volumes" />
      </section>

      <section className="ec2-explorer-table-panel" aria-label="EC2 volumes inventory table panel">
        <EC2ExplorerTable
          metric="volumes"
          groupBy="none"
          loading={isSectionLoading}
          error={volumesQuery.isError ? volumesQuery.error : null}
          table={table}
          onRetry={() => {
            void volumesQuery.refetch();
          }}
          onRowClick={(row) => {
            const volumeId = typeof row.id === "string" ? row.id : null;
            if (!volumeId) return;
            const params = new URLSearchParams(location.search);
            navigate({
              pathname: `${VOLUME_DETAIL_BASE_PATH}/${encodeURIComponent(volumeId)}`,
              search: params.toString(),
            });
          }}
        />
      </section>
    </div>
  );
}
