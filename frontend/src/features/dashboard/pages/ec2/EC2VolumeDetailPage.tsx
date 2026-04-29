import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import type { ColDef } from "ag-grid-community";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useInventoryEc2Snapshots } from "@/features/client-home/hooks/useInventoryEc2Snapshots";
import { useInventoryEc2VolumePerformance } from "@/features/client-home/hooks/useInventoryEc2VolumePerformance";
import type {
  InventoryEc2VolumePerformanceMetric,
  InventoryEc2VolumePerformanceSeries,
  InventoryEc2VolumeRow,
} from "@/features/client-home/api/inventory-volumes.api";
import { useInventoryEc2VolumeDetail, useInventoryEc2Volumes } from "@/features/client-home/hooks/useInventoryEc2Volumes";
import { BaseEChart } from "@/features/dashboard/common/charts/BaseEChart";
import { EmptyStateBlock } from "@/features/dashboard/common/components/EmptyStateBlock";
import { KpiCard } from "@/features/dashboard/common/components/KpiCard";
import { BaseDataTable } from "@/features/dashboard/common/tables/BaseDataTable";
import {
  EC2VolumeDetailHeaderTabs,
  type EC2VolumeDetailTabKey,
} from "./components/EC2VolumeDetailHeaderTabs";

const VOLUMES_PAGE_PATH = "/dashboard/inventory/aws/ec2/volumes";
const INSTANCES_PAGE_PATH = "/dashboard/inventory/aws/ec2/instances";

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const DATE_LABEL_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
});

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const getDefaultDateRange = (): { start: string; end: string } => {
  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return {
    start: toIsoDate(startOfMonth),
    end: toIsoDate(today),
  };
};

const toTitle = (value: string | null | undefined): string => {
  if (!value) return "-";
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return CURRENCY_FORMATTER.format(value);
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return DECIMAL_FORMATTER.format(value);
};

const formatSize = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString()} GB`;
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "-";
  return DATE_TIME_FORMATTER.format(new Date(parsed));
};

const getInsight = (volume: InventoryEc2VolumeRow) => {
  if (volume.isUnattached) {
    return { label: "Unattached", tone: "idle" as const, message: "Volume is unattached and may be a direct savings opportunity." };
  }
  if (volume.isIdleCandidate || volume.isUnderutilizedCandidate) {
    return { label: "High Cost", tone: "warn" as const, message: "Usage indicators suggest potential downsizing or cleanup action." };
  }
  return { label: "Healthy", tone: "good" as const, message: "Current size, attachment, and spend posture look healthy." };
};

const getMetadataDate = (volume: InventoryEc2VolumeRow, keys: string[]): string | null => {
  const metadata = volume.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
};

const getMetadataString = (volume: InventoryEc2VolumeRow, keys: string[]): string | null => {
  const metadata = volume.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return null;
};

const getMetadataNumber = (volume: InventoryEc2VolumeRow, keys: string[]): number | null => {
  const metadata = volume.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const buildLineOption = (
  params: {
    labels: string[];
    yAxisName: string;
    series: Array<{ name: string; data: Array<number | null> }>;
    legend?: string[];
  },
): EChartsOption => {
  const showLegend = (params.legend ?? []).length > 0;
  return {
    tooltip: { trigger: "axis", confine: true },
    legend: showLegend
      ? {
          show: true,
          type: "scroll",
          orient: "horizontal",
          top: 2,
          left: 58,
          right: 14,
          itemWidth: 12,
          itemHeight: 8,
          textStyle: { fontSize: 11 },
        }
      : { show: false },
    grid: { left: 58, right: 14, top: showLegend ? 68 : 40, bottom: 34, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: params.labels,
      axisLabel: { hideOverlap: true, fontSize: 11 },
    },
    yAxis: {
      type: "value",
      name: params.yAxisName,
      nameLocation: "end",
      nameGap: 24,
      nameTextStyle: { fontSize: 11, color: "#6d837e" },
      axisLabel: { fontSize: 11, margin: 10 },
    },
    series: params.series.map((item) => ({
      name: item.name,
      type: "line",
      smooth: 0.42,
      showSymbol: false,
      emphasis: { focus: "series", scale: true },
      symbol: "circle",
      symbolSize: 6,
      lineStyle: { width: 2.3 },
      data: item.data,
    })),
  };
};

const formatPerfLabel = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return DATE_LABEL_DAY.format(parsed);
};

const sumSeriesValues = (series: InventoryEc2VolumePerformanceSeries | undefined): number | null => {
  if (!series || series.points.length === 0) return null;
  return series.points.reduce((sum, point) => sum + point.value, 0);
};

const avgSeriesValue = (series: InventoryEc2VolumePerformanceSeries | undefined): number | null => {
  if (!series || series.points.length === 0) return null;
  return sumSeriesValues(series)! / series.points.length;
};

const metricSeries = (
  collection: InventoryEc2VolumePerformanceSeries[],
  metric: InventoryEc2VolumePerformanceMetric,
): InventoryEc2VolumePerformanceSeries | undefined => collection.find((item) => item.metric === metric);

export default function EC2VolumeDetailPage() {
  const { volumeId } = useParams<{ volumeId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<EC2VolumeDetailTabKey>("overview");

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const defaults = getDefaultDateRange();
  const startDate = queryParams.get("startDate") ?? queryParams.get("from") ?? queryParams.get("billingPeriodStart") ?? defaults.start;
  const endDate = queryParams.get("endDate") ?? queryParams.get("to") ?? queryParams.get("billingPeriodEnd") ?? defaults.end;

  const volumesQuery = useInventoryEc2Volumes({
    startDate,
    endDate,
    search: volumeId ?? null,
    page: 1,
    pageSize: 200,
  });

  const selectedVolume = useMemo(
    () => (volumesQuery.data?.items ?? []).find((item) => item.volumeId === volumeId) ?? null,
    [volumeId, volumesQuery.data?.items],
  );

  const volumeCloudConnectionId = selectedVolume?.cloudConnectionId ?? null;
  const volumeDetailQuery = useInventoryEc2VolumeDetail({
    volumeId: volumeId ?? "",
    cloudConnectionId: volumeCloudConnectionId,
    startDate,
    endDate,
  });
  const performanceQuery = useInventoryEc2VolumePerformance(
    {
      volumeId: volumeId ?? "",
      cloudConnectionId: volumeCloudConnectionId,
      interval: "daily",
      topic: "ebs",
      metrics: [
        "volume_read_ops",
        "volume_write_ops",
        "volume_read_bytes",
        "volume_write_bytes",
        "queue_length",
        "volume_idle_time",
      ],
      startDate,
      endDate,
    },
    Boolean(volumeId),
  );

  const snapshotsQuery = useInventoryEc2Snapshots({
    cloudConnectionId: volumeCloudConnectionId,
    search: selectedVolume?.volumeId ?? null,
    page: 1,
    pageSize: 100,
  });

  const backToVolumes = () => {
    const next = new URLSearchParams(location.search);
    next.delete("volumeId");
    navigate({ pathname: VOLUMES_PAGE_PATH, search: next.toString() });
  };

  if (volumesQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="dashboard-note">Loading volume details...</p>
      </div>
    );
  }

  if (volumesQuery.isError || !selectedVolume) {
    return (
      <div className="dashboard-page">
        <EmptyStateBlock
          title="Unable to load volume details"
          message={volumesQuery.isError ? volumesQuery.error.message : "Volume not found for selected filters."}
          actions={
            <button type="button" className="cost-explorer-state-btn" onClick={backToVolumes}>
              Back to Volumes
            </button>
          }
        />
      </div>
    );
  }

  const volumeName = selectedVolume.volumeName ?? selectedVolume.volumeId;
  const insight = getInsight(selectedVolume);
  const attachedInstance = selectedVolume.attachedInstanceId;
  const attachTime = getMetadataDate(selectedVolume, ["lastAttachedTime", "lastAttachedAt", "attachTime", "attachDate"]);
  const deleteOnTermination = getMetadataString(selectedVolume, ["deleteOnTermination", "DeleteOnTermination"]);
  const encrypted = getMetadataString(selectedVolume, ["encrypted", "Encrypted"]);
  const kmsKey = getMetadataString(selectedVolume, ["kmsKeyId", "kmsKeyArn", "KmsKeyId"]);

  const detailData = volumeDetailQuery.data;
  const totalVolumeCost = detailData?.costBreakdown.totalVolumeCost ?? selectedVolume.mtdCost ?? 0;
  const hasSeparateCostFields = Boolean(
    detailData &&
      (
        detailData.costBreakdown.storageCost > 0 ||
        detailData.costBreakdown.iopsCost > 0 ||
        detailData.costBreakdown.throughputCost > 0 ||
        detailData.costBreakdown.snapshotCost > 0
      ),
  );
  const costRows = [
    {
      type: "Storage",
      cost: hasSeparateCostFields ? detailData?.costBreakdown.storageCost ?? 0 : totalVolumeCost,
    },
    { type: "IOPS", cost: hasSeparateCostFields ? detailData?.costBreakdown.iopsCost ?? 0 : 0 },
    {
      type: "Throughput",
      cost: hasSeparateCostFields ? detailData?.costBreakdown.throughputCost ?? 0 : 0,
    },
    {
      type: "Snapshot",
      cost: hasSeparateCostFields ? detailData?.costBreakdown.snapshotCost ?? 0 : 0,
    },
  ].map((row) => ({
    ...row,
    pct: totalVolumeCost > 0 ? (row.cost / totalVolumeCost) * 100 : 0,
  }));

  const overviewCostTrend = detailData?.trends.costTrend ?? [];
  const overviewSizeTrend = detailData?.trends.sizeTrend ?? [];
  const costTrendOption = buildLineOption({
    labels: overviewCostTrend.map((row) => row.date),
    yAxisName: "USD",
    series: [{ name: "Cost", data: overviewCostTrend.map((row) => row.totalCost) }],
  });
  const sizeTrendOption = buildLineOption({
    labels: overviewSizeTrend.map((row) => row.date),
    yAxisName: "GB",
    series: [{ name: "Size", data: overviewSizeTrend.map((row) => row.sizeGb) }],
  });

  const performanceSeries = performanceQuery.data?.series ?? [];
  const readOpsSeries = metricSeries(performanceSeries, "volume_read_ops");
  const writeOpsSeries = metricSeries(performanceSeries, "volume_write_ops");
  const readBytesSeries = metricSeries(performanceSeries, "volume_read_bytes");
  const writeBytesSeries = metricSeries(performanceSeries, "volume_write_bytes");
  const queueSeries = metricSeries(performanceSeries, "queue_length");
  const idleSeries = metricSeries(performanceSeries, "volume_idle_time");

  const perfKpis = {
    readOps: sumSeriesValues(readOpsSeries),
    writeOps: sumSeriesValues(writeOpsSeries),
    readBytes: sumSeriesValues(readBytesSeries),
    writeBytes: sumSeriesValues(writeBytesSeries),
    iops: (() => {
      const read = sumSeriesValues(readOpsSeries);
      const write = sumSeriesValues(writeOpsSeries);
      if (read === null && write === null) return null;
      return (read ?? 0) + (write ?? 0);
    })(),
    throughput: (() => {
      const read = sumSeriesValues(readBytesSeries);
      const write = sumSeriesValues(writeBytesSeries);
      if (read === null && write === null) return null;
      return (read ?? 0) + (write ?? 0);
    })(),
    queueLength: avgSeriesValue(queueSeries),
    idleTime: avgSeriesValue(idleSeries),
  };

  const iopsPoints = readOpsSeries?.points.map((point, index) => ({
    label: formatPerfLabel(point.timestamp),
    iops: point.value + (writeOpsSeries?.points[index]?.value ?? 0),
  })) ?? [];
  const throughputPoints = readBytesSeries?.points.map((point, index) => ({
    label: formatPerfLabel(point.timestamp),
    throughput: point.value + (writeBytesSeries?.points[index]?.value ?? 0),
  })) ?? [];
  const readWritePoints = readOpsSeries?.points.map((point, index) => ({
    label: formatPerfLabel(point.timestamp),
    read: point.value,
    write: writeOpsSeries?.points[index]?.value ?? null,
  })) ?? [];
  const queueIdlePoints = queueSeries?.points.map((point, index) => ({
    label: formatPerfLabel(point.timestamp),
    queue: point.value,
    idle: idleSeries?.points[index]?.value ?? null,
  })) ?? [];

  const iopsOption = buildLineOption({
    labels: iopsPoints.map((p) => p.label),
    yAxisName: "IOPS",
    series: [{ name: "IOPS", data: iopsPoints.map((p) => p.iops) }],
  });

  const throughputOption = buildLineOption({
    labels: throughputPoints.map((p) => p.label),
    yAxisName: "Bytes",
    series: [{ name: "Throughput", data: throughputPoints.map((p) => p.throughput) }],
  });

  const readWriteOption = buildLineOption({
    labels: readWritePoints.map((p) => p.label),
    yAxisName: "Ops",
    legend: ["Read Ops", "Write Ops"],
    series: [
      { name: "Read Ops", data: readWritePoints.map((p) => p.read) },
      { name: "Write Ops", data: readWritePoints.map((p) => p.write) },
    ],
  });

  const queueIdleOption = buildLineOption({
    labels: queueIdlePoints.map((p) => p.label),
    yAxisName: "Count",
    legend: ["Queue Length", "Idle Time"],
    series: [
      { name: "Queue Length", data: queueIdlePoints.map((p) => p.queue) },
      { name: "Idle Time", data: queueIdlePoints.map((p) => p.idle) },
    ],
  });

  const performanceReady = performanceSeries.some((series) => series.points.length > 0);

  const volumeSnapshots = (snapshotsQuery.data?.items ?? []).filter(
    (snapshot) => snapshot.sourceVolumeId === selectedVolume.volumeId || snapshot.sourceVolumeName === selectedVolume.volumeName,
  );

  const snapshotRows = volumeSnapshots.map((snapshot) => {
    const createdAtMs = snapshot.startTime ? Date.parse(snapshot.startTime) : Number.NaN;
    const nowMs = Date.now();
    const ageDays = Number.isNaN(createdAtMs) ? null : Math.max(0, Math.floor((nowMs - createdAtMs) / (1000 * 60 * 60 * 24)));
    return {
      snapshotId: snapshot.snapshotId,
      createdTime: formatDateTime(snapshot.startTime),
      size: "Needs backend source",
      cost: formatCurrency(snapshot.cost),
      age: ageDays === null ? "-" : `${ageDays} days`,
      recommendation: snapshot.likelyOrphaned ? "Review retention policy" : "Healthy",
    };
  });

  const snapshotColumns: ColDef<(typeof snapshotRows)[number]>[] = [
    { headerName: "Snapshot ID", field: "snapshotId", minWidth: 210 },
    { headerName: "Created Time", field: "createdTime", minWidth: 170 },
    { headerName: "Size", field: "size", minWidth: 130 },
    { headerName: "Cost", field: "cost", minWidth: 120 },
    { headerName: "Age", field: "age", minWidth: 120 },
    { headerName: "Recommendation", field: "recommendation", minWidth: 200 },
  ];

  const recommendationsRows = [
    selectedVolume.isUnattached
      ? {
          type: "Unattached",
          problem: "Volume is not attached",
          evidence: `State: ${toTitle(selectedVolume.state)}, Cost: ${formatCurrency(selectedVolume.mtdCost)}, Size: ${formatSize(selectedVolume.sizeGb)}`,
          action: "Delete volume",
          saving: formatCurrency(selectedVolume.mtdCost * 0.8),
          risk: "Low",
          status: "Open",
        }
      : null,
    selectedVolume.isUnderutilizedCandidate
      ? {
          type: "Oversized",
          problem: "Provisioned above usage",
          evidence: `State: ${toTitle(selectedVolume.state)}, Cost: ${formatCurrency(selectedVolume.mtdCost)}, IOPS: ${formatNumber(selectedVolume.iops)}`,
          action: "Downsize type/size",
          saving: formatCurrency(selectedVolume.mtdCost * 0.25),
          risk: "Low",
          status: "Open",
        }
      : null,
    selectedVolume.isIdleCandidate
      ? {
          type: "Idle",
          problem: "Low activity trend",
          evidence: `State: ${toTitle(selectedVolume.state)}, Cost: ${formatCurrency(selectedVolume.mtdCost)}`,
          action: "Review and stop/delete if unused",
          saving: formatCurrency(selectedVolume.mtdCost * 0.4),
          risk: "Low",
          status: "Open",
        }
      : null,
  ].filter((row): row is NonNullable<(typeof recommendationsRows)[number]> => Boolean(row));

  const recommendationColumns: ColDef<(typeof recommendationsRows)[number]>[] = [
    { headerName: "Type", field: "type", minWidth: 120 },
    { headerName: "Problem", field: "problem", minWidth: 180 },
    { headerName: "Evidence", field: "evidence", minWidth: 230 },
    { headerName: "Action", field: "action", minWidth: 180 },
    { headerName: "Saving", field: "saving", minWidth: 120 },
    { headerName: "Risk", field: "risk", minWidth: 90 },
    { headerName: "Status", field: "status", minWidth: 90 },
  ];

  const metadataRows = Object.entries((selectedVolume.tags as Record<string, unknown> | null) ?? {}).map(([key, value]) => ({
    key,
    value: String(value),
  }));

  return (
    <div className="dashboard-page">
      <section className="ec2-instance-detail" aria-label="EC2 volume detail">
        <EC2VolumeDetailHeaderTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "overview" ? (
          <section className="ec2-instance-detail__panel">
            <section className="overview-kpi-strip overview-kpi-board ec2-instance-detail__kpi-board">
              <div className="overview-kpi-row overview-kpi-row--report ec2-overview-kpi-row">
                <KpiCard label="Volume Cost" value={formatCurrency(totalVolumeCost)} />
                <KpiCard label="Size" value={formatSize(selectedVolume.sizeGb)} />
                <KpiCard label="Type" value={selectedVolume.volumeType ?? "-"} />
                <KpiCard
                  label="State"
                  value={toTitle(selectedVolume.state)}
                  delta={selectedVolume.isAttached ? "Attached" : "Unattached"}
                  deltaTone={selectedVolume.isAttached ? "positive" : "negative"}
                />
              </div>
            </section>

            <table className="ec2-instance-detail__simple-table">
              <tbody>
                <tr>
                  <th>Attached Instance</th>
                  <td>
                    {attachedInstance ? (
                      <button
                        type="button"
                        className="ec2-linked-cell-btn"
                        onClick={() => {
                          const next = new URLSearchParams(location.search);
                          next.set("instanceId", attachedInstance);
                          next.set("search", attachedInstance);
                          navigate({ pathname: `${INSTANCES_PAGE_PATH}/${attachedInstance}`, search: next.toString() });
                        }}
                      >
                        {selectedVolume.attachedInstanceName ?? attachedInstance}
                      </button>
                    ) : (
                      "Unattached"
                    )}
                  </td>
                </tr>
                <tr><th>Instance State</th><td>{toTitle(selectedVolume.attachedInstanceState)}</td></tr>
                <tr><th>Region</th><td>{selectedVolume.regionName ?? selectedVolume.regionId ?? selectedVolume.regionKey ?? "-"}</td></tr>
                <tr><th>Availability Zone</th><td>{selectedVolume.availabilityZone ?? "-"}</td></tr>
              </tbody>
            </table>

            <div className={`ec2-instance-detail__insight ec2-instance-detail__insight--${insight.tone}`}>
              <strong>{insight.label}</strong>
              <span>{insight.message}</span>
            </div>

            <div>
              <h4>Cost Breakdown</h4>
              {volumeDetailQuery.isLoading ? (
                <p className="dashboard-note">Loading cost breakdown...</p>
              ) : volumeDetailQuery.isError ? (
                <p className="dashboard-note">Needs backend source</p>
              ) : (
                <table className="ec2-instance-detail__simple-table">
                  <thead><tr><th>Cost Type</th><th>Cost</th><th>%</th></tr></thead>
                  <tbody>
                    {costRows.map((row) => (
                      <tr key={row.type}>
                        <td>{row.type}</td>
                        <td>{formatCurrency(row.cost)}</td>
                        <td>{DECIMAL_FORMATTER.format(row.pct)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="ec2-instance-detail__charts2">
              <div>
                <h4>Cost Trend</h4>
                {volumeDetailQuery.isLoading ? (
                  <p className="dashboard-note">Loading trend...</p>
                ) : overviewCostTrend.length > 0 ? (
                  <BaseEChart option={costTrendOption} height={260} />
                ) : (
                  <p className="dashboard-note">Needs backend source</p>
                )}
              </div>
              <div>
                <h4>Size Trend</h4>
                {volumeDetailQuery.isLoading ? (
                  <p className="dashboard-note">Loading trend...</p>
                ) : overviewSizeTrend.length > 0 ? (
                  <BaseEChart option={sizeTrendOption} height={260} />
                ) : (
                  <p className="dashboard-note">No size history available</p>
                )}
              </div>
            </div>

            <h4>Metadata</h4>
            <table className="ec2-instance-detail__simple-table">
              <tbody>
                <tr><th>Volume ID</th><td>{selectedVolume.volumeId}</td></tr>
                <tr><th>Name</th><td>{volumeName}</td></tr>
                <tr><th>Created Time</th><td>{formatDateTime(selectedVolume.discoveredAt ?? selectedVolume.usageDate)}</td></tr>
                <tr><th>Attach Time</th><td>{formatDateTime(attachTime)}</td></tr>
                <tr><th>Delete on Termination</th><td>{deleteOnTermination ?? "-"}</td></tr>
                <tr><th>Encrypted</th><td>{encrypted ?? "-"}</td></tr>
                <tr><th>KMS Key</th><td>{kmsKey ?? "-"}</td></tr>
              </tbody>
            </table>

            <table className="ec2-instance-detail__simple-table">
              <thead><tr><th>Tag</th><th>Value</th></tr></thead>
              <tbody>
                {metadataRows.length === 0 ? <tr><td colSpan={2}>No tags available</td></tr> : null}
                {metadataRows.map((row) => <tr key={row.key}><td>{row.key}</td><td>{row.value}</td></tr>)}
              </tbody>
            </table>
          </section>
        ) : null}

        {activeTab === "performance" ? (
          <section className="ec2-instance-detail__panel">
            {performanceQuery.isLoading ? <p className="dashboard-note">Loading performance data...</p> : null}
            {performanceQuery.isError ? <p className="dashboard-note">Failed to load performance data: {performanceQuery.error.message}</p> : null}
            {!performanceQuery.isLoading && !performanceQuery.isError && !performanceReady ? <p className="dashboard-note">No performance data available</p> : null}

            {performanceReady ? (
              <>
                <div className="ec2-instance-detail__kpis ec2-instance-detail__kpis--compact">
                  <div className="ec2-instance-detail__kpi"><span>Read Ops</span><strong>{formatNumber(perfKpis.readOps)}</strong></div>
                  <div className="ec2-instance-detail__kpi"><span>Write Ops</span><strong>{formatNumber(perfKpis.writeOps)}</strong></div>
                  <div className="ec2-instance-detail__kpi"><span>Read Bytes</span><strong>{formatNumber(perfKpis.readBytes)}</strong></div>
                  <div className="ec2-instance-detail__kpi"><span>Write Bytes</span><strong>{formatNumber(perfKpis.writeBytes)}</strong></div>
                  <div className="ec2-instance-detail__kpi"><span>IOPS</span><strong>{formatNumber(perfKpis.iops)}</strong></div>
                  <div className="ec2-instance-detail__kpi"><span>Throughput</span><strong>{formatNumber(perfKpis.throughput)}</strong></div>
                  <div className="ec2-instance-detail__kpi"><span>Queue Length</span><strong>{formatNumber(perfKpis.queueLength)}</strong></div>
                  <div className="ec2-instance-detail__kpi"><span>Idle Time</span><strong>{formatNumber(perfKpis.idleTime)}</strong></div>
                </div>
                <div className="ec2-instance-detail__charts2">
                  <div><h4>IOPS Trend</h4>{iopsPoints.length > 0 ? <BaseEChart option={iopsOption} height={240} /> : <p className="dashboard-note">No performance data available</p>}</div>
                  <div><h4>Throughput Trend</h4>{throughputPoints.length > 0 ? <BaseEChart option={throughputOption} height={240} /> : <p className="dashboard-note">No performance data available</p>}</div>
                  <div><h4>Read/Write Trend</h4>{readWritePoints.length > 0 ? <BaseEChart option={readWriteOption} height={240} /> : <p className="dashboard-note">No performance data available</p>}</div>
                  <div><h4>Queue/Idle Trend</h4>{queueIdlePoints.length > 0 ? <BaseEChart option={queueIdleOption} height={240} /> : <p className="dashboard-note">No performance data available</p>}</div>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {activeTab === "snapshots" ? (
          <section className="ec2-instance-detail__panel">
            {snapshotsQuery.isLoading ? <p className="dashboard-note">Loading snapshots...</p> : null}
            {snapshotsQuery.isError ? <p className="dashboard-note">Failed to load snapshots: {snapshotsQuery.error.message}</p> : null}

            {!snapshotsQuery.isLoading && !snapshotsQuery.isError ? (
              <>
                <section className="overview-kpi-strip overview-kpi-board ec2-instance-detail__kpi-board">
                  <div className="overview-kpi-row overview-kpi-row--report ec2-overview-kpi-row">
                    <KpiCard label="Snapshot Count" value={String(volumeSnapshots.length)} />
                    <KpiCard label="Total Snapshot Cost" value={formatCurrency(volumeSnapshots.reduce((sum, row) => sum + (row.cost ?? 0), 0))} />
                  </div>
                </section>
                {snapshotRows.length === 0 ? (
                  <p className="dashboard-note">No data available</p>
                ) : (
                  <BaseDataTable columnDefs={snapshotColumns} rowData={snapshotRows} autoHeight />
                )}
              </>
            ) : null}
          </section>
        ) : null}

        {activeTab === "recommendations" ? (
          <section className="ec2-instance-detail__panel">
            {recommendationsRows.length === 0 ? (
              <p className="dashboard-note">No optimization opportunities found for this volume.</p>
            ) : (
              <BaseDataTable columnDefs={recommendationColumns} rowData={recommendationsRows} autoHeight />
            )}
          </section>
        ) : null}
      </section>
    </div>
  );
}
