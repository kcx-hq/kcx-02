import { useEffect, useMemo, useState } from "react"
import type { EChartsOption } from "echarts"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  type InventoryEc2InstancePerformancePoint,
  type InventoryEc2PerformanceInterval,
  type InventoryEc2PerformanceMetric,
  type InventoryEc2PerformanceTopic,
  type InventoryEc2InstanceRow,
} from "@/features/client-home/api/inventory-instances.api"
import { useInventoryEc2InstancePerformance } from "@/features/client-home/hooks/useInventoryEc2InstancePerformance"
import { BaseEChart } from "@/features/dashboard/common/charts/BaseEChart"
import { ApiError } from "@/lib/api"

type TimePreset = "last_7_days" | "last_30_days" | "month_to_date" | "all_available"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  instance: InventoryEc2InstanceRow | null
}

const TOPIC_LABELS: Record<InventoryEc2PerformanceTopic, string> = {
  cpu: "CPU",
  network: "Network",
  disk_throughput: "Disk Throughput",
  disk_operations: "Disk Operations",
  ebs: "EBS",
  health: "Health",
}

const TOPIC_METRICS: Record<InventoryEc2PerformanceTopic, Array<{ value: InventoryEc2PerformanceMetric; label: string }>> = {
  cpu: [
    { value: "cpu_avg", label: "Avg CPU %" },
    { value: "cpu_max", label: "Max CPU %" },
    { value: "cpu_min", label: "Min CPU %" },
  ],
  network: [
    { value: "network_in_bytes", label: "Network In" },
    { value: "network_out_bytes", label: "Network Out" },
  ],
  disk_throughput: [
    { value: "disk_read_bytes", label: "Disk Read Bytes" },
    { value: "disk_write_bytes", label: "Disk Write Bytes" },
  ],
  disk_operations: [
    { value: "disk_read_ops", label: "Disk Read Ops" },
    { value: "disk_write_ops", label: "Disk Write Ops" },
  ],
  ebs: [
    { value: "ebs_read_bytes", label: "EBS Read Bytes" },
    { value: "ebs_write_bytes", label: "EBS Write Bytes" },
    { value: "ebs_queue_length_max", label: "EBS Queue Length Max" },
    { value: "ebs_burst_balance_avg", label: "EBS Burst Balance Avg" },
    { value: "ebs_idle_time_avg", label: "EBS Idle Time Avg" },
  ],
  health: [
    { value: "status_check_failed_max", label: "Status Check Failed" },
    { value: "status_check_failed_instance_max", label: "Instance Status Check Failed" },
    { value: "status_check_failed_system_max", label: "System Status Check Failed" },
  ],
}

const DEFAULT_METRIC_BY_TOPIC: Record<InventoryEc2PerformanceTopic, InventoryEc2PerformanceMetric> = {
  cpu: "cpu_avg",
  network: "network_in_bytes",
  disk_throughput: "disk_read_bytes",
  disk_operations: "disk_read_ops",
  ebs: "ebs_read_bytes",
  health: "status_check_failed_max",
}

const COLORS = ["#2f8f88", "#3f68c6", "#c27d2f"]

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
})

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
})

const hourLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
})

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function resolveDatesFromPreset(preset: TimePreset): { startDate?: string; endDate?: string } {
  const today = new Date()
  const endDate = toIsoDate(today)
  if (preset === "all_available") return {}
  if (preset === "month_to_date") {
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    return { startDate: toIsoDate(monthStart), endDate }
  }
  const dayOffset = preset === "last_7_days" ? 6 : 29
  const start = new Date(today)
  start.setUTCDate(start.getUTCDate() - dayOffset)
  return { startDate: toIsoDate(start), endDate }
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value)) return "-"
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let size = Math.abs(value)
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  const signed = value < 0 ? -size : size
  const decimals = signed >= 100 ? 0 : signed >= 10 ? 1 : 2
  return `${signed.toFixed(decimals)} ${units[unitIndex]}`
}

function formatValueByUnit(value: number, unit: "percent" | "bytes" | "count"): string {
  if (unit === "percent") return `${percentFormatter.format(value)}%`
  if (unit === "bytes") return formatBytes(value)
  return compactFormatter.format(value)
}

export function InstancePerformanceDetailModal({ open, onOpenChange, instance }: Props) {
  const [interval, setInterval] = useState<InventoryEc2PerformanceInterval>("daily")
  const [topic, setTopic] = useState<InventoryEc2PerformanceTopic>("cpu")
  const [selectedMetric, setSelectedMetric] = useState<InventoryEc2PerformanceMetric>("cpu_avg")
  const [timePreset, setTimePreset] = useState<TimePreset>("last_30_days")

  useEffect(() => {
    if (!open) return
    setInterval("daily")
    setTopic("cpu")
    setSelectedMetric("cpu_avg")
    setTimePreset("last_30_days")
  }, [open, instance?.instanceId])

  const dateFilter = useMemo(() => resolveDatesFromPreset(timePreset), [timePreset])

  const performanceQuery = useInventoryEc2InstancePerformance(
    {
      instanceId: instance?.instanceId ?? "",
      cloudConnectionId: instance?.cloudConnectionId ?? null,
      interval,
      topic,
      metrics: [selectedMetric],
      startDate: dateFilter.startDate ?? null,
      endDate: dateFilter.endDate ?? null,
    },
    open && Boolean(instance?.instanceId),
  )

  const activeSeries = performanceQuery.data?.series ?? []
  const primaryUnit = activeSeries[0]?.unit ?? "count"

  const chartOption = useMemo<EChartsOption>(() => {
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line" },
      },
      legend: {
        show: activeSeries.length > 1,
        top: 0,
      },
      grid: {
        left: 12,
        right: 12,
        top: activeSeries.length > 1 ? 50 : 28,
        bottom: 20,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data:
          activeSeries[0]?.points.map((point) => {
            const parsed = new Date(point.timestamp)
            return interval === "hourly"
              ? hourLabelFormatter.format(parsed)
              : dayLabelFormatter.format(parsed)
          }) ?? [],
        axisLabel: { color: "#48605f", fontSize: 12 },
        axisLine: { lineStyle: { color: "#d7e4df" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: "#6d837e",
          fontSize: 11,
          formatter: (value: number) => formatValueByUnit(value, primaryUnit),
        },
        splitLine: { lineStyle: { color: "#e5efec" } },
      },
      series: activeSeries.map((series, index) => ({
        name: series.label,
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.4, color: COLORS[index % COLORS.length] },
        itemStyle: { color: COLORS[index % COLORS.length] },
        data: series.points.map((point: InventoryEc2InstancePerformancePoint) => point.value),
      })),
    }
  }, [activeSeries, interval, primaryUnit])

  const errorMessage =
    performanceQuery.error instanceof ApiError
      ? performanceQuery.error.message
      : performanceQuery.error instanceof Error
        ? performanceQuery.error.message
        : "Failed to load performance details."

  const metricOptions = TOPIC_METRICS[topic]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto rounded-none">
        {instance ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-left text-lg">Performance Detail</DialogTitle>
              <div className="space-y-0.5 text-sm text-text-secondary">
                <p className="font-medium text-text-primary">{instance.instanceName}</p>
                <p>{instance.instanceId}</p>
                <p>
                  {[instance.instanceType, instance.subAccountName].filter(Boolean).join(" · ") || " "}
                </p>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 border-y border-[color:var(--border-light)] py-3 md:grid-cols-5">
              <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                Interval
                <select
                  value={interval}
                  onChange={(event) => setInterval(event.target.value as InventoryEc2PerformanceInterval)}
                  className="h-9 w-full rounded-none border border-[color:var(--border-light)] bg-transparent px-2 text-sm font-normal text-text-primary outline-none"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                </select>
              </label>

              <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                Topic
                <select
                  value={topic}
                  onChange={(event) => {
                    const nextTopic = event.target.value as InventoryEc2PerformanceTopic
                    setTopic(nextTopic)
                    setSelectedMetric(DEFAULT_METRIC_BY_TOPIC[nextTopic])
                  }}
                  className="h-9 w-full rounded-none border border-[color:var(--border-light)] bg-transparent px-2 text-sm font-normal text-text-primary outline-none"
                >
                  {Object.entries(TOPIC_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                Metrics
                <select
                  value={selectedMetric}
                  onChange={(event) => setSelectedMetric(event.target.value as InventoryEc2PerformanceMetric)}
                  className="h-9 w-full rounded-none border border-[color:var(--border-light)] bg-transparent px-2 text-sm font-normal text-text-primary outline-none"
                >
                  {metricOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                Time
                <select
                  value={timePreset}
                  onChange={(event) => setTimePreset(event.target.value as TimePreset)}
                  className="h-9 w-full rounded-none border border-[color:var(--border-light)] bg-transparent px-2 text-sm font-normal text-text-primary outline-none"
                >
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="last_30_days">Last 30 Days</option>
                  <option value="month_to_date">Month to Date</option>
                  <option value="all_available">All Available</option>
                </select>
              </label>

              <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                Chart
                <select
                  value="line"
                  disabled
                  className="h-9 w-full rounded-none border border-[color:var(--border-light)] bg-transparent px-2 text-sm font-normal text-text-primary outline-none"
                >
                  <option value="line">Line</option>
                </select>
              </label>
            </div>

            <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
              {performanceQuery.isLoading ? (
                <div className="h-[420px] animate-pulse rounded bg-[color:var(--bg-surface-hover)]" />
              ) : null}
              {performanceQuery.isError ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{errorMessage}</div>
              ) : null}
              {!performanceQuery.isLoading && !performanceQuery.isError && activeSeries.every((series) => series.points.length === 0) ? (
                <div className="flex h-[420px] items-center justify-center text-sm text-text-secondary">
                  No performance data available for the selected filters.
                </div>
              ) : null}
              {!performanceQuery.isLoading && !performanceQuery.isError && activeSeries.some((series) => series.points.length > 0) ? (
                <BaseEChart option={chartOption} height={420} />
              ) : null}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-none border-[color:var(--border-light)] bg-transparent text-text-primary hover:bg-transparent"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
