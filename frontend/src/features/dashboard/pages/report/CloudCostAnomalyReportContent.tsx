import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocation, useNavigate } from "react-router-dom"
import {
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { reportApi } from "./report.api"
import type { CloudCostAnomalyReport, CloudCostReportQuery } from "./report.types"

type CloudCostAnomalyReportContentProps = {
  standalone?: boolean
}

const CHART_COLORS = ["#1d4ed8", "#0ea5e9", "#14b8a6", "#94a3b8", "#a855f7", "#f97316"]

function getDefaultPreviousMonthRange() {
  const now = new Date()
  const firstDayPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const lastDayPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
  return {
    startDate: firstDayPrevMonth.toISOString().slice(0, 10),
    endDate: lastDayPrevMonth.toISOString().slice(0, 10),
  }
}

function readInitialQuery(): CloudCostReportQuery {
  const defaults = getDefaultPreviousMonthRange()
  if (typeof window === "undefined") {
    return defaults
  }

  const params = new URLSearchParams(window.location.search)
  const startDate = params.get("startDate") ?? defaults.startDate
  const endDate = params.get("endDate") ?? defaults.endDate
  const billingSourceIdRaw = params.get("billingSourceId")
  const billingSourceId = billingSourceIdRaw ? Number(billingSourceIdRaw) : undefined

  return {
    startDate,
    endDate,
    billingSourceId: Number.isInteger(billingSourceId) && (billingSourceId ?? 0) > 0 ? billingSourceId : undefined,
  }
}

function parseQueryDate(value: string | null) {
  if (!value) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function isPdfRenderMode() {
  if (typeof window === "undefined") return false
  const params = new URLSearchParams(window.location.search)
  return params.get("renderMode") === "pdf"
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number, withPlus: boolean = false) {
  const normalized = `${Math.abs(value).toFixed(1)}%`
  if (!withPlus) return normalized
  return value >= 0 ? `+${normalized}` : `-${normalized}`
}

function formatDateLabel(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function buildTrendChartData(report: CloudCostAnomalyReport | undefined) {
  if (!report) return []
  return report.trendData.map((item) => ({
    ...item,
    dateLabel: formatDateLabel(item.date),
  }))
}

function SummaryCards({ report }: { report: CloudCostAnomalyReport }) {
  return (
    <section className="border-y border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
      <article className="border-b border-slate-200 px-4 py-4 xl:border-b-0 xl:border-r xl:border-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Cost</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(report.summary.totalCost)}</p>
      </article>

      <article className="border-b border-slate-200 px-4 py-4 xl:border-b-0 xl:border-r xl:border-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cost Change</p>
        <p
          className={`mt-2 text-2xl font-semibold ${
            report.summary.costChangePercentage >= 0 ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {formatPercent(report.summary.costChangePercentage, true)}
        </p>
        <p className="mt-1 text-xs text-slate-500">vs Last Month</p>
      </article>

      <article className="border-b border-slate-200 px-4 py-4 xl:border-b-0 xl:border-r xl:border-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anomalies Detected</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{report.summary.anomalyCount}</p>
      </article>

      <article className="px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top Service</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{report.summary.topService}</p>
        <p className="mt-1 text-xs text-slate-500">{formatPercent(report.summary.topServicePercentage)} of Cost</p>
      </article>
      </div>
    </section>
  )
}

export function CloudCostAnomalyReportContent({ standalone = false }: CloudCostAnomalyReportContentProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const initialQuery = useMemo(() => readInitialQuery(), [])
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const [isDownloading, setIsDownloading] = useState(false)
  const hideControlsForPdf = isPdfRenderMode()

  const startDate = parseQueryDate(queryParams.get("billingPeriodStart") ?? queryParams.get("from")) ?? initialQuery.startDate
  const endDate = parseQueryDate(queryParams.get("billingPeriodEnd") ?? queryParams.get("to")) ?? initialQuery.endDate
  const billingSourceIdRaw = queryParams.get("billingSourceId")
  const billingSourceId = billingSourceIdRaw ? Number(billingSourceIdRaw) : undefined
  const normalizedBillingSourceId =
    typeof billingSourceId === "number" && Number.isInteger(billingSourceId) && billingSourceId > 0
      ? billingSourceId
      : undefined

  const query = useMemo<CloudCostReportQuery>(
    () => ({
      startDate,
      endDate,
      ...(typeof normalizedBillingSourceId === "number" ? { billingSourceId: normalizedBillingSourceId } : {}),
    }),
    [startDate, endDate, normalizedBillingSourceId],
  )

  const reportQuery = useQuery({
    queryKey: ["cloud-cost-anomaly-report", query],
    queryFn: () => reportApi.getCloudCostAnomalyReport(query),
  })

  const report = reportQuery.data
  const trendData = useMemo(() => buildTrendChartData(report), [report])
  const spikePoint = useMemo(() => {
    if (!trendData.length) return null
    return trendData.reduce((max, current) => (current.cost > max.cost ? current : max))
  }, [trendData])
  const generatedAt = report
    ? new Date(report.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : ""

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true)
      await reportApi.downloadCloudCostAnomalyPdf(query)
    } finally {
      setIsDownloading(false)
    }
  }

  function handleBillingSourceChange(value: string) {
    const nextValue = Number(value)
    const nextBillingSourceId = Number.isInteger(nextValue) && nextValue > 0 ? nextValue : undefined
    const nextParams = new URLSearchParams(location.search)
    if (typeof nextBillingSourceId === "number") {
      nextParams.set("billingSourceId", String(nextBillingSourceId))
    } else {
      nextParams.delete("billingSourceId")
    }

    navigate({ pathname: location.pathname, search: nextParams.toString() }, { replace: true })
  }

  return (
    <section className={`${standalone ? "min-h-screen bg-slate-100 py-10" : "py-2"} text-slate-900`}>
      <div
        className={`${standalone ? "mx-auto w-full max-w-[1080px] px-4 md:px-8" : "w-full"}`}
        data-report-ready={report && !reportQuery.isFetching ? "true" : "false"}
        id="cloud-cost-anomaly-report-ready"
      >
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-8 print:rounded-none print:border-none print:p-0 print:shadow-none">
          {reportQuery.isLoading ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Generating cloud cost report...</p>
              <div className="h-3 animate-pulse rounded bg-slate-200" />
              <div className="h-3 animate-pulse rounded bg-slate-200" />
              <div className="h-3 animate-pulse rounded bg-slate-200" />
            </div>
          ) : null}

          {reportQuery.isError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              Failed to load report data. Please verify your date range and authentication session.
            </div>
          ) : null}

          {report ? (
            <div className="space-y-6">
              <header className="space-y-2">
                <h1 className="text-center text-3xl font-semibold tracking-tight text-slate-900">{report.title}</h1>
                <div className="flex flex-col gap-2 border-y border-slate-200 py-3 text-sm text-slate-600 md:flex-row md:justify-between">
                  <p>Period: {report.period}</p>
                  <p>Generated: {generatedAt}</p>
                </div>
                {!hideControlsForPdf ? (
                  <div className="border-b border-slate-200 py-4 print:hidden">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-1">
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                          <select
                            value={typeof normalizedBillingSourceId === "number" ? String(normalizedBillingSourceId) : ""}
                            onChange={(event) => handleBillingSourceChange(event.target.value)}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                          >
                            <option value="">All Sources</option>
                            {(report?.billingSources ?? []).map((source) => (
                              <option key={source.id} value={source.id}>
                                {source.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={isDownloading || reportQuery.isLoading}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isDownloading ? "Generating PDF..." : "Download PDF"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </header>

              <SummaryCards report={report} />

              <section className="rounded-xl border border-slate-200 p-4 md:p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Cost Trend</h2>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 16, right: 16, bottom: 4, left: 4 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "#64748b" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(value) => `$${Math.round(Number(value))}`} />
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value))}
                        labelStyle={{ color: "#0f172a" }}
                        contentStyle={{ borderRadius: 12, borderColor: "#cbd5e1" }}
                      />
                      <Line type="monotone" dataKey="cost" stroke="#1d4ed8" strokeWidth={2.4} dot={false} />
                      {spikePoint ? (
                        <ReferenceDot x={spikePoint.dateLabel} y={spikePoint.cost} r={5} fill="#dc2626" stroke="#dc2626">
                          <Label value={`Spike on ${spikePoint.dateLabel}`} position="top" fill="#dc2626" fontSize={11} />
                        </ReferenceDot>
                      ) : null}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4 md:p-5">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Cost Breakdown</h2>
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={report.breakdownData}
                          dataKey="cost"
                          nameKey="service"
                          outerRadius={100}
                          innerRadius={48}
                          paddingAngle={2}
                        >
                          {report.breakdownData.map((item, index) => (
                            <Cell key={item.service} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 md:p-5">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Top Contributors</h2>
                  <ol className="space-y-2">
                    {report.topContributors.map((item) => (
                      <li key={item.rank} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">#{item.rank}</p>
                          <p className="text-sm font-medium text-slate-900">{item.name}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-4 md:p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Anomaly Table</h2>
                {report.anomalies.length === 0 ? (
                  <p className="text-sm text-slate-500">No anomalies detected for this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Service</th>
                          <th className="px-3 py-2">Actual Cost</th>
                          <th className="px-3 py-2">Expected Cost</th>
                          <th className="px-3 py-2">Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.anomalies.map((item) => (
                          <tr key={`${item.date}-${item.service}`} className="border-b border-slate-100 text-slate-700">
                            <td className="px-3 py-2">{item.date}</td>
                            <td className="px-3 py-2">{item.service}</td>
                            <td className="px-3 py-2">{formatCurrency(item.actualCost)}</td>
                            <td className="px-3 py-2">{formatCurrency(item.expectedCost)}</td>
                            <td className="px-3 py-2 font-medium text-rose-600">{formatCurrency(item.impact)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 p-4 md:p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Insights</h2>
                <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                  {report.insights.map((insight, index) => (
                    <li key={`${insight.slice(0, 20)}-${index}`}>{insight}</li>
                  ))}
                </ul>
              </section>

              <footer className="pt-2 text-center text-xs text-slate-400">Generated by XYZ Cloud Analytics</footer>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  )
}

