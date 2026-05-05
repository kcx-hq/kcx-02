import { useMemo } from "react";
import type { EChartsOption } from "echarts";
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

const VOLUMES_PAGE_PATH = "/dashboard/inventory/aws/ec2/volumes";
const INSTANCES_PAGE_PATH = "/dashboard/inventory/aws/ec2/instances";
const SNAPSHOTS_PAGE_PATH = "/dashboard/inventory/aws/ec2/snapshots";

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

const getTagValue = (tags: Record<string, unknown>, key: string): string => {
  const exact = tags[key];
  if (typeof exact === "string" && exact.trim().length > 0) return exact;
  const found = Object.entries(tags).find(([k]) => k.toLowerCase() === key.toLowerCase());
  return found ? String(found[1]) : "-";
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

  const updateDateRange = (key: "startDate" | "endDate", value: string) => {
    const next = new URLSearchParams(location.search);
    next.set(key, value);
    navigate({ pathname: location.pathname, search: next.toString() });
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
  const attachedInstance = selectedVolume.attachedInstanceId;
  const attachTime = getMetadataDate(selectedVolume, ["lastAttachedTime", "lastAttachedAt", "attachTime", "attachDate"]);
  const deleteOnTermination = getMetadataString(selectedVolume, ["deleteOnTermination", "DeleteOnTermination"]);
  const encrypted = getMetadataString(selectedVolume, ["encrypted", "Encrypted"]);
  const kmsKey = getMetadataString(selectedVolume, ["kmsKeyId", "kmsKeyArn", "KmsKeyId"]);

  const detailData = volumeDetailQuery.data;
  const totalVolumeCost = detailData?.costBreakdown.totalVolumeCost ?? selectedVolume.mtdCost ?? 0;
  const volumeSnapshotCount = detailData?.snapshot.snapshotCount ?? selectedVolume.snapshotCount ?? 0;
  const volumeSnapshotCost = detailData?.snapshot.snapshotCost ?? selectedVolume.snapshotCost ?? 0;
  const overviewSizeTrend = detailData?.trends.sizeTrend ?? [];

  const performanceSeries = performanceQuery.data?.series ?? [];
  const readOpsSeries = metricSeries(performanceSeries, "volume_read_ops");
  const writeOpsSeries = metricSeries(performanceSeries, "volume_write_ops");
  const readBytesSeries = metricSeries(performanceSeries, "volume_read_bytes");
  const writeBytesSeries = metricSeries(performanceSeries, "volume_write_bytes");
  const queueSeries = metricSeries(performanceSeries, "queue_length");
  const idleSeries = metricSeries(performanceSeries, "volume_idle_time");

  const perfKpis = {
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

  const perfTelemetryPresent = performanceSeries.some((series) => series.points.length > 0);
  const lowActivity = selectedVolume.isIdleCandidate || selectedVolume.isUnderutilizedCandidate;
  const queueRisk = (perfKpis.queueLength ?? 0) > 5;
  const snapshotHeavy = totalVolumeCost > 0 && volumeSnapshotCost / totalVolumeCost > 0.3;
  const inefficiencies: string[] = [];

  if (selectedVolume.isUnattached) inefficiencies.push("Volume is unattached and continues to incur cost.");
  if (selectedVolume.isUnderutilizedCandidate) inefficiencies.push("Utilization signals suggest the volume may be oversized.");
  if (selectedVolume.isIdleCandidate) inefficiencies.push("Idle behavior indicates low active usage.");
  if (snapshotHeavy) inefficiencies.push("Snapshot spend is high relative to storage cost.");
  if (queueRisk) inefficiencies.push("Queue length indicates intermittent storage pressure.");

  const potentialSavings = selectedVolume.isUnattached
    ? totalVolumeCost * 0.8
    : selectedVolume.isIdleCandidate
      ? totalVolumeCost * 0.4
      : selectedVolume.isUnderutilizedCandidate
        ? totalVolumeCost * 0.25
        : 0;

  const decisionStatus = selectedVolume.isUnattached
    ? "Risk"
    : inefficiencies.length > 0
      ? "Optimization Opportunity"
      : "Healthy";

  const decisionHeadline = selectedVolume.isUnattached
    ? "Unattached volume requires immediate review"
    : decisionStatus === "Healthy"
      ? "Healthy Storage Usage"
      : "Underutilized volume - consider downsizing";

  const decisionSubtext = decisionStatus === "Healthy"
    ? `${formatCurrency(totalVolumeCost)}/month - no optimization needed`
    : inefficiencies[0] ?? "Review suggested to improve storage efficiency.";

  const tags = (selectedVolume.tags as Record<string, unknown> | null) ?? {};
  const environment = getTagValue(tags, "Environment");
  const product = getTagValue(tags, "Product");

  const activityLevel = selectedVolume.isUnattached
    ? "Low"
    : lowActivity
      ? "Low"
      : (perfKpis.iops ?? 0) > 10000
        ? "High"
        : perfTelemetryPresent
          ? "Moderate"
          : "Moderate";

  const idleBehavior = selectedVolume.isIdleCandidate
    ? "Frequent idle windows detected"
    : perfTelemetryPresent
      ? "No material idle concern detected"
      : "Telemetry is limited for idle-time analysis";

  const queueHealth = queueRisk
    ? "Watch queue pressure"
    : perfTelemetryPresent
      ? "Queue depth is healthy"
      : "Queue data is limited";

  const utilizationConclusion = selectedVolume.isUnattached
    ? "Volume is unattached and should be remediated to avoid unnecessary spend."
    : lowActivity
      ? "Volume shows low activity and may be oversized."
      : "Volume is actively used and right-sized.";

  const metadataRows = Object.entries(tags).map(([key, value]) => ({
    key,
    value: String(value),
  }));

  return (
    <div className="dashboard-page">
      <section className="ec2-instance-detail" aria-label="EC2 volume detail">
   
        <section className="ec2-instance-detail__panel ec2-instance-detail__summary-card">
          <div className="ec2-instance-detail__summary-head">
            <span className={`ec2-instance-detail__status-pill ec2-instance-detail__status-pill--${decisionStatus.toLowerCase().replaceAll(" ", "-")}`}>
              {decisionStatus}
            </span>
            <strong>{formatCurrency(totalVolumeCost)}/month</strong>
          </div>
          <div className="ec2-instance-detail__summary-grid">
            <div><span>Decision</span><strong>{decisionHeadline}</strong></div>
            <div><span>Explanation</span><strong>{decisionSubtext}</strong></div>
            <div><span>Potential savings</span><strong>{potentialSavings > 0 ? `${formatCurrency(potentialSavings)}/month` : "No material savings"}</strong></div>
            <div><span>Risk posture</span><strong>{selectedVolume.isUnattached ? "Critical" : decisionStatus === "Healthy" ? "Low" : "Medium"}</strong></div>
          </div>
        </section>

        <section className="ec2-instance-detail__panel">
          <h3>Context</h3>
          <table className="ec2-instance-detail__simple-table">
            <tbody>
              <tr>
                <th>Attached Instance</th>
                <td>
                  {attachedInstance ? (
                    <>
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
                      </button>{" "}
                      ({toTitle(selectedVolume.attachedInstanceState)})
                    </>
                  ) : "Unattached"}
                </td>
              </tr>
              <tr>
                <th>Environment / Product</th>
                <td>{environment} / {product}</td>
              </tr>
              <tr>
                <th>Region / AZ</th>
                <td>{selectedVolume.regionName ?? selectedVolume.regionId ?? selectedVolume.regionKey ?? "-"} / {selectedVolume.availabilityZone ?? "-"}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="ec2-instance-detail__panel">
          <h3>Key Signals</h3>
          <section className="overview-kpi-strip overview-kpi-board ec2-instance-detail__kpi-board">
            <div className="overview-kpi-row overview-kpi-row--report ec2-overview-kpi-row">
              <KpiCard label="Cost" value={formatCurrency(totalVolumeCost)} />
              <KpiCard label="Size" value={formatSize(selectedVolume.sizeGb)} />
              <KpiCard label="Type" value={selectedVolume.volumeType ?? "-"} />
              <KpiCard label="State" value={toTitle(selectedVolume.state)} />
              <KpiCard label="IOPS" value={formatNumber(perfKpis.iops ?? selectedVolume.iops)} />
              <KpiCard label="Throughput" value={formatNumber(perfKpis.throughput ?? selectedVolume.throughput)} />
            </div>
          </section>
        </section>

        <section className="ec2-instance-detail__panel">
          <h3>Utilization Insight</h3>
          <div className="ec2-instance-detail__kpis ec2-instance-detail__kpis--compact">
            <div className="ec2-instance-detail__kpi"><span>Activity Level</span><strong>{activityLevel}</strong></div>
            <div className="ec2-instance-detail__kpi"><span>Idle Behavior</span><strong>{idleBehavior}</strong></div>
            <div className="ec2-instance-detail__kpi"><span>Queue Health</span><strong>{queueHealth}</strong></div>
          </div>
          <div className={`ec2-instance-detail__insight ${lowActivity || selectedVolume.isUnattached ? "ec2-instance-detail__insight--warn" : "ec2-instance-detail__insight--good"}`}>
            <strong>{utilizationConclusion}</strong>
            {inefficiencies.length > 0 ? <span>{inefficiencies.join(" ")}</span> : null}
          </div>
        </section>

        <section className="ec2-instance-detail__panel">
          <h3>Cost &amp; Efficiency</h3>
          <table className="ec2-instance-detail__simple-table">
            <tbody>
              <tr><th>Monthly Cost</th><td>{formatCurrency(totalVolumeCost)}</td></tr>
              <tr><th>Snapshot Cost</th><td>{formatCurrency(volumeSnapshotCost)}</td></tr>
              <tr><th>Growth Signal</th><td>{overviewSizeTrend.length > 1 && overviewSizeTrend.at(-1) && overviewSizeTrend[0] ? `${formatNumber((overviewSizeTrend.at(-1)!.sizeGb ?? 0) - (overviewSizeTrend[0].sizeGb ?? 0))} GB change in selected range` : "Stable size profile"}</td></tr>
              <tr><th>Inefficiencies</th><td>{inefficiencies.length > 0 ? inefficiencies.join(" ") : "No inefficiencies detected"}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="ec2-instance-detail__panel">
          <details>
            <summary><strong>Performance Trends</strong></summary>
            <div className="ec2-instance-detail__charts2">
              {iopsPoints.length > 0 ? <div><h4>IOPS Trend</h4><BaseEChart option={iopsOption} height={240} /></div> : null}
              {throughputPoints.length > 0 ? <div><h4>Throughput Trend</h4><BaseEChart option={throughputOption} height={240} /></div> : null}
            </div>
          </details>
        </section>

        <section className="ec2-instance-detail__panel">
          <h3>Snapshots</h3>
          <table className="ec2-instance-detail__simple-table">
            <tbody>
              <tr><th>Snapshot Count</th><td>{volumeSnapshotCount}</td></tr>
              <tr><th>Total Snapshot Cost</th><td>{formatCurrency(volumeSnapshotCost)}</td></tr>
              <tr>
                <th>Details</th>
                <td>
                  <button
                    type="button"
                    className="ec2-linked-cell-btn"
                    onClick={() => {
                      const next = new URLSearchParams(location.search);
                      next.set("volumeId", selectedVolume.volumeId);
                      navigate({ pathname: SNAPSHOTS_PAGE_PATH, search: next.toString() });
                    }}
                  >
                    View Snapshots
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="ec2-instance-detail__panel">
          <details>
            <summary><strong>Metadata</strong></summary>
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

            {metadataRows.length > 0 ? (
              <table className="ec2-instance-detail__simple-table">
                <thead><tr><th>Tag</th><th>Value</th></tr></thead>
                <tbody>
                  {metadataRows.map((row) => <tr key={row.key}><td>{row.key}</td><td>{row.value}</td></tr>)}
                </tbody>
              </table>
            ) : null}
          </details>
        </section>
      </section>
    </div>
  );
}
