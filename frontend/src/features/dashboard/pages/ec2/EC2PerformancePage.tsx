import { useEffect, useMemo, useRef, useState } from "react"
import type { EChartsOption } from "echarts"
import { useQueries } from "@tanstack/react-query"
import { Check, ChevronDown, Search } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import {
  getInventoryEc2InstancePerformance,
  type InventoryEc2InstanceRow,
  type InventoryEc2PerformanceInterval,
  type InventoryEc2PerformanceMetric,
  type InventoryEc2PerformanceTopic,
} from "@/features/client-home/api/inventory-instances.api"
import {
  getInventoryEc2VolumePerformance,
  type InventoryEc2VolumePerformanceMetric,
  type InventoryEc2VolumeRow,
} from "@/features/client-home/api/inventory-volumes.api"
import { useInventoryEc2Instances } from "@/features/client-home/hooks/useInventoryEc2Instances"
import { useInventoryEc2InstancePerformance } from "@/features/client-home/hooks/useInventoryEc2InstancePerformance"
import { useInventoryEc2VolumePerformance } from "@/features/client-home/hooks/useInventoryEc2VolumePerformance"
import { useInventoryEc2Volumes } from "@/features/client-home/hooks/useInventoryEc2Volumes"
import { BaseEChart } from "../../common/charts/BaseEChart"

type ResourceType = "instance" | "volume"
type Mode = "single" | "compare"
type ChartType = "line" | "bar"
type MetricUnit = "percent" | "bytes" | "count"
type MetricId = InventoryEc2PerformanceMetric | InventoryEc2VolumePerformanceMetric
type PopoverKey = "resourceType" | "resource" | "interval" | "topic" | "metrics" | "chartType"

type MetricOption = { id: MetricId; label: string; unit: MetricUnit }
type TopicOption = { id: string; label: string; metrics: MetricOption[]; defaultMetrics?: MetricId[] }
type ResourceConfig = { label: string; pluralLabel: string; defaultTopic: string; topics: TopicOption[] }

const COMPARE_RESOURCE_CAP = 30
const PICKER_LIMIT = 100
const ALL_OPTION_ID = "__all__"
const COLORS = ["#2f8f88", "#3f68c6", "#c27d2f", "#8a66cf", "#da6f40"]

const DATE_LABEL_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
})

const DATE_LABEL_HOUR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
})

const DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })
const COUNT_FORMATTER = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

const CONFIG: Record<ResourceType, ResourceConfig> = {
  instance: {
    label: "Instance",
    pluralLabel: "Instances",
    defaultTopic: "cpu",
    topics: [
      { id: "cpu", label: "CPU", metrics: [{ id: "cpu_avg", label: "Avg CPU %", unit: "percent" }, { id: "cpu_max", label: "Max CPU %", unit: "percent" }, { id: "cpu_min", label: "Min CPU %", unit: "percent" }] },
      { id: "network", label: "Network", metrics: [{ id: "network_in_bytes", label: "Network In Bytes", unit: "bytes" }, { id: "network_out_bytes", label: "Network Out Bytes", unit: "bytes" }] },
      { id: "disk_throughput", label: "Disk Throughput", metrics: [{ id: "disk_read_bytes", label: "Disk Read Bytes", unit: "bytes" }, { id: "disk_write_bytes", label: "Disk Write Bytes", unit: "bytes" }] },
      { id: "disk_operations", label: "Disk Operations", metrics: [{ id: "disk_read_ops", label: "Disk Read Ops", unit: "count" }, { id: "disk_write_ops", label: "Disk Write Ops", unit: "count" }] },
      { id: "ebs", label: "EBS", metrics: [{ id: "ebs_read_bytes", label: "EBS Read Bytes", unit: "bytes" }, { id: "ebs_write_bytes", label: "EBS Write Bytes", unit: "bytes" }, { id: "ebs_queue_length_max", label: "EBS Queue Length Max", unit: "count" }, { id: "ebs_burst_balance_avg", label: "EBS Burst Balance Avg", unit: "percent" }, { id: "ebs_idle_time_avg", label: "EBS Idle Time Avg", unit: "percent" }] },
      { id: "health", label: "Health", metrics: [{ id: "status_check_failed_max", label: "Status Check Failed", unit: "count" }, { id: "status_check_failed_instance_max", label: "Instance Status Check Failed", unit: "count" }, { id: "status_check_failed_system_max", label: "System Status Check Failed", unit: "count" }] },
    ],
  },
  volume: {
    label: "Volume",
    pluralLabel: "Volumes",
    defaultTopic: "ebs",
    topics: [
      {
        id: "ebs",
        label: "EBS",
        defaultMetrics: ["volume_read_bytes", "volume_write_bytes"],
        metrics: [
          { id: "volume_read_bytes", label: "Volume Read Bytes", unit: "bytes" },
          { id: "volume_write_bytes", label: "Volume Write Bytes", unit: "bytes" },
          { id: "volume_read_ops", label: "Volume Read Ops", unit: "count" },
          { id: "volume_write_ops", label: "Volume Write Ops", unit: "count" },
          { id: "queue_length", label: "Volume Queue Length", unit: "count" },
          { id: "burst_balance", label: "Burst Balance", unit: "percent" },
          { id: "volume_idle_time", label: "Volume Idle Time", unit: "count" },
        ],
      },
    ],
  },
}

const parseCsv = (value: string | null) =>
  (value ?? "").split(",").map((item) => item.trim()).filter((item) => item.length > 0)

const getDefaultTopicMetrics = (topic: TopicOption): MetricId[] => {
  const preferred = (topic.defaultMetrics ?? []).filter((id) => topic.metrics.some((metric) => metric.id === id))
  if (preferred.length > 0) return Array.from(new Set(preferred))
  return topic.metrics.slice(0, 1).map((metric) => metric.id)
}

const isResourceType = (value: string | null): value is ResourceType => value === "instance" || value === "volume"
const isInterval = (value: string | null): value is InventoryEc2PerformanceInterval => value === "daily" || value === "hourly"
const isChartType = (value: string | null): value is ChartType => value === "line" || value === "bar"

const parseIsoDate = (value: string | null): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? (value as string) : null)

const formatBytes = (value: number) => {
  if (!Number.isFinite(value)) return "-"
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let size = Math.abs(value)
  let i = 0
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i += 1 }
  const signed = value < 0 ? -size : size
  const decimals = signed >= 100 ? 0 : signed >= 10 ? 1 : 2
  return `${signed.toFixed(decimals)} ${units[i]}`
}

const formatValue = (value: number, unit: MetricUnit) =>
  unit === "percent" ? `${DECIMAL_FORMATTER.format(value)}%` : unit === "bytes" ? formatBytes(value) : COUNT_FORMATTER.format(value)

const aggregateValues = (values: number[], unit: MetricUnit) => {
  if (values.length === 0) return 0
  if (unit === "percent") return values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((a, b) => a + b, 0)
}

const DAY_MS = 24 * 60 * 60 * 1000

const toUtcDayKey = (value: string): string | null => {
  const direct = value.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0")
  const day = String(parsed.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const utcDayKeyToMs = (dayKey: string): number => {
  const [year, month, day] = dayKey.split("-").map((part) => Number(part))
  return Date.UTC(year, month - 1, day)
}

const buildDailyTimeline = (
  series: Array<{ points: Array<{ timestamp: string }> }>,
  startDate: string | null,
  endDate: string | null,
) => {
  const daySet = new Set<string>()
  for (const item of series) {
    for (const point of item.points) {
      const dayKey = toUtcDayKey(point.timestamp)
      if (dayKey) daySet.add(dayKey)
    }
  }

  const sortedKnownDays = Array.from(daySet).sort((a, b) => utcDayKeyToMs(a) - utcDayKeyToMs(b))
  const fallbackStart = sortedKnownDays[0] ?? null
  const fallbackEnd = sortedKnownDays[sortedKnownDays.length - 1] ?? null
  const rangeStart = startDate ?? fallbackStart
  const rangeEnd = endDate ?? fallbackEnd
  if (!rangeStart || !rangeEnd) return [] as Array<{ key: string; label: string }>

  let startMs = utcDayKeyToMs(rangeStart)
  let endMs = utcDayKeyToMs(rangeEnd)
  if (startMs > endMs) [startMs, endMs] = [endMs, startMs]

  const timeline: Array<{ key: string; label: string }> = []
  for (let cursor = startMs; cursor <= endMs; cursor += DAY_MS) {
    const isoDay = new Date(cursor).toISOString().slice(0, 10)
    timeline.push({ key: isoDay, label: DATE_LABEL_DAY.format(new Date(cursor)) })
  }
  return timeline
}

const buildHourlyTimeline = (series: Array<{ points: Array<{ timestamp: string }> }>) => {
  const pointMap = new Map<number, string>()
  for (const item of series) {
    for (const point of item.points) {
      const parsed = new Date(point.timestamp)
      const ms = parsed.getTime()
      if (Number.isNaN(ms)) continue
      pointMap.set(ms, point.timestamp)
    }
  }

  return Array.from(pointMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ms, raw]) => ({ key: raw, label: DATE_LABEL_HOUR.format(new Date(ms)) }))
}

export default function EC2PerformancePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])

  const [activePopover, setActivePopover] = useState<PopoverKey | null>(null)
  const [resourceSearch, setResourceSearch] = useState("")
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current) return
      if (rootRef.current.contains(event.target as Node)) return
      setActivePopover(null)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setActivePopover(null) }
    window.addEventListener("mousedown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [])

  const resourceType: ResourceType = isResourceType(params.get("resourceType")) ? (params.get("resourceType") as ResourceType) : "instance"
  const config = CONFIG[resourceType]
  const resourceId = (params.get("resourceId") ?? "").trim()
  const resourceIds = parseCsv(params.get("resourceIds"))
  const allResources = resourceId
    ? false
    : params.get("allResources") === null
      ? true
      : params.get("allResources") === "true"
  const mode: Mode = resourceId ? "single" : "compare"

  const interval: InventoryEc2PerformanceInterval = isInterval(params.get("interval")) ? (params.get("interval") as InventoryEc2PerformanceInterval) : "daily"
  const chartType: ChartType = isChartType(params.get("chartType")) ? (params.get("chartType") as ChartType) : mode === "single" ? "line" : "bar"

  const topic = config.topics.find((item) => item.id === params.get("topic")) ?? config.topics.find((item) => item.id === config.defaultTopic) ?? config.topics[0]
  const defaultTopicMetrics = getDefaultTopicMetrics(topic)
  const metricMap = new Map(topic.metrics.map((m) => [m.id, m]))
  const rawMetrics = parseCsv(params.get("metrics")).filter((id): id is MetricId => metricMap.has(id))
  const effectiveRawMetrics = rawMetrics.length > 0 ? rawMetrics : defaultTopicMetrics
  const firstMetric = effectiveRawMetrics[0] ?? topic.metrics[0]?.id
  const firstUnit = topic.metrics.find((metric) => metric.id === firstMetric)?.unit ?? topic.metrics[0]?.unit ?? "count"
  const selectedMetrics = Array.from(new Set(effectiveRawMetrics.filter((id): id is MetricId => metricMap.has(id))))
  const safeMetrics: MetricId[] =
    selectedMetrics.length > 0
      ? selectedMetrics
      : defaultTopicMetrics.length > 0
        ? defaultTopicMetrics
        : topic.metrics.slice(0, 1).map((m) => m.id)

  const startDate = parseIsoDate(params.get("billingPeriodStart") ?? params.get("from"))
  const endDate = parseIsoDate(params.get("billingPeriodEnd") ?? params.get("to"))

  const updateParams = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(location.search)
    mutate(next)
    navigate({ pathname: location.pathname, search: next.toString() }, { replace: true })
  }

  const instancesQuery = useInventoryEc2Instances({ page: 1, pageSize: PICKER_LIMIT, search: resourceSearch.trim().length > 0 ? resourceSearch.trim() : null })
  const volumesQuery = useInventoryEc2Volumes({ page: 1, pageSize: PICKER_LIMIT, search: resourceSearch.trim().length > 0 ? resourceSearch.trim() : null })
  const instanceOptions = instancesQuery.data?.items ?? []
  const volumeOptions = volumesQuery.data?.items ?? []
  const options = resourceType === "instance" ? instanceOptions : volumeOptions

  const instanceLookup = useMemo(() => new Map(instanceOptions.map((item) => [item.instanceId, item] as const)), [instanceOptions])
  const volumeLookup = useMemo(() => new Map(volumeOptions.map((item) => [item.volumeId, item] as const)), [volumeOptions])

  const compareIds = useMemo(() => {
    if (mode !== "compare") return []
    if (allResources) return resourceType === "instance" ? instanceOptions.map((item) => item.instanceId) : volumeOptions.map((item) => item.volumeId)
    return resourceIds
  }, [allResources, instanceOptions, mode, resourceIds, resourceType, volumeOptions])
  const compareIdsLimited = compareIds.slice(0, COMPARE_RESOURCE_CAP)

  const selectedInstance = resourceType === "instance" ? instanceLookup.get(resourceId) ?? null : null
  const selectedVolume = resourceType === "volume" ? volumeLookup.get(resourceId) ?? null : null

  const singleInstanceQuery = useInventoryEc2InstancePerformance(
    { instanceId: resourceId, cloudConnectionId: selectedInstance?.cloudConnectionId ?? null, interval, topic: topic.id as InventoryEc2PerformanceTopic, metrics: safeMetrics as InventoryEc2PerformanceMetric[], startDate, endDate },
    mode === "single" && resourceType === "instance" && resourceId.length > 0,
  )
  const singleVolumeQuery = useInventoryEc2VolumePerformance(
    { volumeId: resourceId, cloudConnectionId: selectedVolume?.cloudConnectionId ?? null, interval, topic: "ebs", metrics: safeMetrics as InventoryEc2VolumePerformanceMetric[], startDate, endDate },
    mode === "single" && resourceType === "volume" && resourceId.length > 0,
  )

  const compareInstanceQueries = useQueries({
    queries: compareIdsLimited.map((id) => ({
      queryKey: ["inventory", "aws", "ec2", "instance-performance", "compare", id, interval, topic.id, safeMetrics.join(","), startDate ?? "default", endDate ?? "default"],
      queryFn: () => getInventoryEc2InstancePerformance({ instanceId: id, cloudConnectionId: instanceLookup.get(id)?.cloudConnectionId ?? null, interval, topic: topic.id as InventoryEc2PerformanceTopic, metrics: safeMetrics as InventoryEc2PerformanceMetric[], startDate, endDate }),
      enabled: mode === "compare" && resourceType === "instance",
      staleTime: 30_000,
    })),
  })

  const compareVolumeQueries = useQueries({
    queries: compareIdsLimited.map((id) => ({
      queryKey: ["inventory", "aws", "ec2", "volume-performance", "compare", id, interval, topic.id, safeMetrics.join(","), startDate ?? "default", endDate ?? "default"],
      queryFn: () => getInventoryEc2VolumePerformance({ volumeId: id, cloudConnectionId: volumeLookup.get(id)?.cloudConnectionId ?? null, interval, topic: "ebs", metrics: safeMetrics as InventoryEc2VolumePerformanceMetric[], startDate, endDate }),
      enabled: mode === "compare" && resourceType === "volume",
      staleTime: 30_000,
    })),
  })

  const singleQuery = resourceType === "instance" ? singleInstanceQuery : singleVolumeQuery
  const singleSeries = singleQuery.data?.series ?? []
  const singleUnit: MetricUnit = (singleSeries[0]?.unit ?? firstUnit) as MetricUnit
  const singleChartReady = singleSeries.some((series) => series.points.length > 0)
  const singleTimeline = useMemo(
    () => interval === "daily" ? buildDailyTimeline(singleSeries, startDate, endDate) : buildHourlyTimeline(singleSeries),
    [endDate, interval, singleSeries, startDate],
  )

  const singleChartOption = useMemo<EChartsOption>(() => ({
    tooltip: { trigger: "axis", axisPointer: { type: "line" }, valueFormatter: (value) => formatValue(Number(value ?? 0), singleUnit) },
    legend: { show: true, top: 0 },
    grid: { left: 12, right: 12, top: 50, bottom: 20, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: singleTimeline.map((point) => point.label),
      axisLabel: { color: "#48605f", fontSize: 12 },
      axisLine: { lineStyle: { color: "#d7e4df" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#6d837e", fontSize: 11, formatter: (value: number) => formatValue(value, singleUnit) },
      splitLine: { lineStyle: { color: "#e5efec" } },
    },
    series: singleSeries.map((series, index) => ({
      name: series.label,
      type: chartType === "bar" ? "bar" : "line",
      smooth: chartType === "line",
      showSymbol: false,
      barMaxWidth: chartType === "bar" ? 24 : undefined,
      lineStyle: chartType === "line" ? { width: 2.4, color: COLORS[index % COLORS.length] } : undefined,
      itemStyle: { color: COLORS[index % COLORS.length], borderRadius: chartType === "bar" ? [4, 4, 0, 0] : 0 },
      data: (() => {
        const valueByKey = new Map<string, number>()
        for (const point of series.points) {
          const key = interval === "daily" ? toUtcDayKey(point.timestamp) : point.timestamp
          if (!key) continue
          valueByKey.set(key, point.value)
        }
        return singleTimeline.map((point) => valueByKey.get(point.key) ?? null)
      })(),
    })),
  }), [chartType, interval, singleSeries, singleTimeline, singleUnit])

  const compareQueries = resourceType === "instance" ? compareInstanceQueries : compareVolumeQueries
  const compareLoading = compareQueries.some((q) => q.isLoading)
  const compareError = compareQueries.find((q) => q.isError)?.error
  const compareLabels = compareIdsLimited.map((id) => resourceType === "instance" ? (instanceLookup.get(id)?.instanceName ?? id) : (volumeLookup.get(id)?.volumeName ?? id))
  const compareSeries = safeMetrics.map((metricId, index) => {
    const meta = topic.metrics.find((metric) => metric.id === metricId)
    const unit = meta?.unit ?? firstUnit
    const data = compareQueries.map((query) => {
      const series = query.data?.series.find((item) => item.metric === metricId)
      return aggregateValues(series?.points.map((p) => p.value) ?? [], unit)
    })
    return { name: meta?.label ?? String(metricId), unit, color: COLORS[index % COLORS.length], data }
  })
  const compareUnit: MetricUnit = (compareSeries[0]?.unit ?? firstUnit) as MetricUnit
  const compareChartReady = compareSeries.some((series) => series.data.some((value) => Number.isFinite(value) && value !== 0))

  const compareChartOption = useMemo<EChartsOption>(() => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (value) => formatValue(Number(value ?? 0), compareUnit) },
    legend: { show: true, top: 0 },
    grid: { left: 12, right: 12, top: 50, bottom: 20, containLabel: true },
    xAxis: { type: "category", data: compareLabels, axisLabel: { color: "#48605f", fontSize: 12 }, axisLine: { lineStyle: { color: "#d7e4df" } }, axisTick: { show: false } },
    yAxis: { type: "value", axisLabel: { color: "#6d837e", fontSize: 11, formatter: (value: number) => formatValue(value, compareUnit) }, splitLine: { lineStyle: { color: "#e5efec" } } },
    series: compareSeries.map((series) => ({
      name: series.name,
      type: chartType === "line" ? "line" : "bar",
      smooth: chartType === "line",
      showSymbol: false,
      barMaxWidth: chartType === "bar" ? 24 : undefined,
      itemStyle: { color: series.color, borderRadius: chartType === "bar" ? [4, 4, 0, 0] : 0 },
      lineStyle: chartType === "line" ? { width: 2.4, color: series.color } : undefined,
      data: series.data,
    })),
  }), [chartType, compareLabels, compareSeries, compareUnit])

  const resourceTypeLabel = resourceType === "instance" ? "Instance" : "Volume"
  const resourceDisplay = mode === "single"
    ? (resourceType === "instance"
      ? `${selectedInstance?.instanceName ?? selectedInstance?.instanceId ?? "Select instance"}`
      : `${selectedVolume?.volumeName ?? selectedVolume?.volumeId ?? "Select volume"}`)
    : allResources ? `All ${config.pluralLabel}` : `${resourceIds.length} selected`
  const metricsDisplay = safeMetrics.map((metricId) => topic.metrics.find((m) => m.id === metricId)?.label ?? metricId).join(", ")
  const chartDisplay = chartType === "line" ? "Line Chart" : "Bar Chart"

  const shouldPromptSingle = mode === "single" && resourceId.length === 0
  const shouldPromptCompare = mode === "compare" && !allResources && compareIdsLimited.length === 0

  const clearAll = () => {
    updateParams((next) => {
      next.delete("resourceId")
      next.delete("resourceIds")
      next.set("allResources", "true")
      next.set("resourceType", "instance")
      next.set("topic", CONFIG.instance.defaultTopic)
      next.set("metrics", CONFIG.instance.topics[0]?.metrics[0]?.id ?? "cpu_avg")
      next.set("interval", "daily")
      next.set("chartType", "bar")
    })
  }

  const onResourceTypeChange = (nextType: ResourceType) => {
    const nextConfig = CONFIG[nextType]
    const nextTopic = nextConfig.topics.find((item) => item.id === nextConfig.defaultTopic) ?? nextConfig.topics[0]
    const nextTopicMetrics = getDefaultTopicMetrics(nextTopic)
    updateParams((next) => {
      next.set("resourceType", nextType)
      next.delete("resourceId")
      next.delete("resourceIds")
      next.set("allResources", "true")
      next.set("topic", nextTopic.id)
      next.set("metrics", nextTopicMetrics.join(","))
      next.set("chartType", "bar")
    })
  }

  const onResourceSingleSelect = (id: string) => {
    if (id === ALL_OPTION_ID) {
      updateParams((next) => {
        next.delete("resourceId")
        next.delete("resourceIds")
        next.set("allResources", "true")
        next.set("chartType", "bar")
      })
      return
    }
    updateParams((next) => {
      next.set("resourceId", id)
      next.delete("resourceIds")
      next.set("allResources", "false")
      next.set("chartType", "line")
    })
  }

  const onResourceCompareToggle = (id: string) => {
    if (id === ALL_OPTION_ID) {
      updateParams((next) => {
        next.delete("resourceIds")
        next.delete("resourceId")
        next.set("allResources", "true")
        next.set("chartType", "bar")
      })
      return
    }
    const current = new Set(resourceIds)
    if (current.has(id)) current.delete(id)
    else current.add(id)
    const list = Array.from(current)
    if (list.length === 1) {
      updateParams((next) => {
        next.set("resourceId", list[0])
        next.delete("resourceIds")
        next.set("allResources", "false")
        next.set("chartType", "line")
      })
      return
    }
    updateParams((next) => {
      next.delete("resourceId")
      if (list.length > 0) next.set("resourceIds", list.join(","))
      else next.delete("resourceIds")
      next.set("allResources", "false")
      next.set("chartType", "bar")
    })
  }

  const onTopicChange = (topicId: string) => {
    const nextTopic = config.topics.find((item) => item.id === topicId)
    if (!nextTopic) return
    const nextTopicMetrics = getDefaultTopicMetrics(nextTopic)
    updateParams((next) => {
      next.set("topic", nextTopic.id)
      next.set("metrics", nextTopicMetrics.join(","))
    })
  }

  const onMetricsToggle = (metricId: MetricId) => {
    const selected = safeMetrics.includes(metricId)
    if (!topic.metrics.some((metric) => metric.id === metricId)) return

    let nextMetrics: MetricId[] = []
    if (selected) {
      nextMetrics = safeMetrics.filter((id) => id !== metricId)
    } else {
      nextMetrics = [...safeMetrics, metricId]
    }

    nextMetrics = Array.from(new Set(nextMetrics))
    if (nextMetrics.length === 0) {
      nextMetrics = getDefaultTopicMetrics(topic).slice(0, 1)
    }
    updateParams((next) => next.set("metrics", nextMetrics.join(",")))
  }

  const resourcePopoverOptions = mode === "single"
    ? [{ id: ALL_OPTION_ID, label: `All ${config.pluralLabel}` }, ...options.map((item) => ({ id: resourceType === "instance" ? item.instanceId : item.volumeId, label: `${resourceType === "instance" ? item.instanceName : item.volumeName}` }))]
    : [{ id: ALL_OPTION_ID, label: `All ${config.pluralLabel}` }, ...options.map((item) => ({ id: resourceType === "instance" ? item.instanceId : item.volumeId, label: `${resourceType === "instance" ? item.instanceName : item.volumeName}` }))]

  return (
    <div className="dashboard-page">
      <section className="dashboard-section" ref={rootRef}>
        <div className="dashboard-section__body">
          <section className="cost-explorer-control-surface" aria-label="Performance filters">
            <div className="cost-explorer-toolbar-row">
              <div className="cost-explorer-toolbar-item">
                <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "resourceType" ? " is-active" : ""}`} onClick={() => setActivePopover((x) => x === "resourceType" ? null : "resourceType")}>
                  <span className="cost-explorer-toolbar-trigger__label">Resource Type</span>
                  <span className="cost-explorer-toolbar-trigger__row"><span className="cost-explorer-toolbar-trigger__value">{resourceTypeLabel}</span><ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} /></span>
                </button>
                {activePopover === "resourceType" ? (
                  <div className="cost-explorer-filter-popover" role="dialog">
                    <p className="cost-explorer-filter-popover__title">Resource Type</p>
                    <div className="cost-explorer-filter-popover__list">
                      {(["instance", "volume"] as const).map((type) => (
                        <button key={type} type="button" className={`cost-explorer-filter-option${resourceType === type ? " is-active" : ""}`} onClick={() => { onResourceTypeChange(type); setActivePopover(null) }}>
                          <span className="cost-explorer-filter-option__content"><span className="cost-explorer-filter-option__label">{type === "instance" ? "Instance" : "Volume"}</span></span>
                          {resourceType === type ? <Check className="cost-explorer-filter-option__check" size={15} /> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="cost-explorer-toolbar-item">
                <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "resource" ? " is-active" : ""}`} onClick={() => setActivePopover((x) => x === "resource" ? null : "resource")}>
                  <span className="cost-explorer-toolbar-trigger__label">{config.pluralLabel}</span>
                  <span className="cost-explorer-toolbar-trigger__row"><span className="cost-explorer-toolbar-trigger__value">{resourceDisplay}</span><ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} /></span>
                </button>
                {activePopover === "resource" ? (
                  <div className="cost-explorer-filter-popover" role="dialog">
                    <p className="cost-explorer-filter-popover__title">{config.pluralLabel}</p>
                    <label className="cost-explorer-filter-popover__search-wrap">
                      <Search className="cost-explorer-filter-popover__search-icon" size={14} />
                      <input className="cost-explorer-filter-popover__search-input" value={resourceSearch} onChange={(e) => setResourceSearch(e.target.value)} placeholder={`Search ${config.label.toLowerCase()}...`} />
                    </label>
                    <div className="cost-explorer-filter-popover__list">
                      {resourcePopoverOptions.map((item) => {
                        const selected = item.id === ALL_OPTION_ID ? allResources : mode === "single" ? resourceId === item.id : resourceIds.includes(item.id)
                        return (
                          <button key={item.id} type="button" className={`cost-explorer-filter-option${selected ? " is-active" : ""}`} onClick={() => mode === "single" ? onResourceSingleSelect(item.id) : onResourceCompareToggle(item.id)}>
                            <span className="cost-explorer-filter-option__content"><span className="cost-explorer-filter-option__label">{item.label}</span></span>
                            {selected ? <Check className="cost-explorer-filter-option__check" size={15} /> : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="cost-explorer-toolbar-item">
                <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "interval" ? " is-active" : ""}`} onClick={() => setActivePopover((x) => x === "interval" ? null : "interval")}>
                  <span className="cost-explorer-toolbar-trigger__label">Granularity</span>
                  <span className="cost-explorer-toolbar-trigger__row"><span className="cost-explorer-toolbar-trigger__value">{interval === "daily" ? "Daily" : "Hourly"}</span><ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} /></span>
                </button>
                {activePopover === "interval" ? (
                  <div className="cost-explorer-filter-popover" role="dialog">
                    <p className="cost-explorer-filter-popover__title">Granularity</p>
                    <div className="cost-explorer-filter-popover__list">
                      {(["daily", "hourly"] as const).map((value) => (
                        <button key={value} type="button" className={`cost-explorer-filter-option${interval === value ? " is-active" : ""}`} onClick={() => { updateParams((next) => next.set("interval", value)); setActivePopover(null) }}>
                          <span className="cost-explorer-filter-option__content"><span className="cost-explorer-filter-option__label">{value === "daily" ? "Daily" : "Hourly"}</span></span>
                          {interval === value ? <Check className="cost-explorer-filter-option__check" size={15} /> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="cost-explorer-toolbar-item">
                <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "topic" ? " is-active" : ""}`} onClick={() => setActivePopover((x) => x === "topic" ? null : "topic")}>
                  <span className="cost-explorer-toolbar-trigger__label">Topic</span>
                  <span className="cost-explorer-toolbar-trigger__row"><span className="cost-explorer-toolbar-trigger__value">{topic.label}</span><ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} /></span>
                </button>
                {activePopover === "topic" ? (
                  <div className="cost-explorer-filter-popover" role="dialog">
                    <p className="cost-explorer-filter-popover__title">Topic</p>
                    <div className="cost-explorer-filter-popover__list">
                      {config.topics.map((item) => (
                        <button key={item.id} type="button" className={`cost-explorer-filter-option${topic.id === item.id ? " is-active" : ""}`} onClick={() => { onTopicChange(item.id); setActivePopover(null) }}>
                          <span className="cost-explorer-filter-option__content"><span className="cost-explorer-filter-option__label">{item.label}</span></span>
                          {topic.id === item.id ? <Check className="cost-explorer-filter-option__check" size={15} /> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="cost-explorer-toolbar-item">
                <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "metrics" ? " is-active" : ""}`} onClick={() => setActivePopover((x) => x === "metrics" ? null : "metrics")}>
                  <span className="cost-explorer-toolbar-trigger__label">Metrics</span>
                  <span className="cost-explorer-toolbar-trigger__row"><span className="cost-explorer-toolbar-trigger__value">{metricsDisplay}</span><ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} /></span>
                </button>
                {activePopover === "metrics" ? (
                  <div className="cost-explorer-filter-popover" role="dialog">
                    <p className="cost-explorer-filter-popover__title">Metrics</p>
                    <div className="cost-explorer-filter-popover__list">
                      {topic.metrics.map((metric) => {
                        const selected = safeMetrics.includes(metric.id)
                        return (
                          <button
                            key={metric.id}
                            type="button"
                            className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                            onClick={() => onMetricsToggle(metric.id)}
                          >
                            <span className="cost-explorer-filter-option__content"><span className="cost-explorer-filter-option__label">{metric.label}</span></span>
                            {selected ? <Check className="cost-explorer-filter-option__check" size={15} /> : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="cost-explorer-toolbar-item">
                <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "chartType" ? " is-active" : ""}`} onClick={() => setActivePopover((x) => x === "chartType" ? null : "chartType")}>
                  <span className="cost-explorer-toolbar-trigger__label">Chart</span>
                  <span className="cost-explorer-toolbar-trigger__row"><span className="cost-explorer-toolbar-trigger__value">{chartDisplay}</span><ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} /></span>
                </button>
                {activePopover === "chartType" ? (
                  <div className="cost-explorer-filter-popover cost-explorer-filter-popover--right" role="dialog">
                    <p className="cost-explorer-filter-popover__title">Chart Type</p>
                    <div className="cost-explorer-filter-popover__list">
                      {(["line", "bar"] as const).map((type) => (
                        <button key={type} type="button" className={`cost-explorer-filter-option${chartType === type ? " is-active" : ""}`} onClick={() => { updateParams((next) => next.set("chartType", type)); setActivePopover(null) }}>
                          <span className="cost-explorer-filter-option__content"><span className="cost-explorer-filter-option__label">{type === "line" ? "Line Chart" : "Bar Chart"}</span></span>
                          {chartType === type ? <Check className="cost-explorer-filter-option__check" size={15} /> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="cost-explorer-chip-bar">
              <div className="cost-explorer-chip-row">
                <span className="cost-explorer-chip"><span className="cost-explorer-chip__edit">Granularity: {interval === "daily" ? "Daily" : "Hourly"}</span></span>
                <span className="cost-explorer-chip"><span className="cost-explorer-chip__edit">Topic: {topic.label}</span></span>
                <span className="cost-explorer-chip"><span className="cost-explorer-chip__edit">{mode === "single" ? `${config.label}: ${resourceDisplay}` : `${config.pluralLabel}: ${resourceDisplay}`}</span></span>
                <span className="cost-explorer-chip"><span className="cost-explorer-chip__edit">Metrics: {metricsDisplay}</span></span>
                <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={clearAll}>Clear all</button>
              </div>
            </div>
          </section>

          {shouldPromptSingle ? <p className="dashboard-note">Select a resource to view performance.</p> : null}
          {shouldPromptCompare ? <p className="dashboard-note">Select resources or choose All to compare performance.</p> : null}

          {mode === "single" && resourceId && singleQuery.isLoading ? <p className="dashboard-note">Loading performance data...</p> : null}
          {mode === "single" && resourceId && singleQuery.isError ? <p className="dashboard-note">Failed to load performance data: {singleQuery.error.message}</p> : null}
          {mode === "single" && resourceId && !singleQuery.isLoading && !singleQuery.isError && !singleChartReady ? <p className="dashboard-note">No performance data available for the selected combination.</p> : null}

          {mode === "compare" && (allResources || compareIdsLimited.length > 0) && compareLoading ? <p className="dashboard-note">Loading comparison data...</p> : null}
          {mode === "compare" && compareError ? <p className="dashboard-note">Failed to load comparison data: {compareError instanceof Error ? compareError.message : "Unknown error"}</p> : null}
          {mode === "compare" && (allResources || compareIdsLimited.length > 0) && !compareLoading && !compareError && !compareChartReady ? <p className="dashboard-note">No comparison data available for the selected combination.</p> : null}

          {mode === "single" && resourceId && singleChartReady ? <BaseEChart option={singleChartOption} height={460} /> : null}
          {mode === "compare" && (allResources || compareIdsLimited.length > 0) && compareChartReady ? <BaseEChart option={compareChartOption} height={460} /> : null}
        </div>
      </section>
    </div>
  )
}
