import { appEnv } from "@/lib/env"
import { getAuthToken } from "@/lib/auth"
import { apiGet } from "@/lib/api"
import type { CloudCostAnomalyReport, CloudCostReportQuery } from "./report.types"

function withQuery(path: string, query: CloudCostReportQuery) {
  const params = new URLSearchParams({
    startDate: query.startDate,
    endDate: query.endDate,
  })
  if (typeof query.billingSourceId === "number") {
    params.set("billingSourceId", String(query.billingSourceId))
  }
  return `${path}?${params.toString()}`
}

function buildUrl(path: string) {
  const base = appEnv.apiBaseUrl.replace(/\/$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${base}${normalizedPath}`
}

export const reportApi = {
  getCloudCostAnomalyReport(query: CloudCostReportQuery) {
    return apiGet<CloudCostAnomalyReport>(withQuery("/reports/cloud-cost-anomaly", query))
  },

  async downloadCloudCostAnomalyPdf(query: CloudCostReportQuery): Promise<void> {
    const url = buildUrl(withQuery("/reports/cloud-cost-anomaly/pdf", query))
    const token = getAuthToken()
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!response.ok) {
      throw new Error("Failed to download report PDF")
    }

    const blob = await response.blob()
    const downloadUrl = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    const filename = `cloud-cost-anomaly-report-${query.startDate}_to_${query.endDate}.pdf`
    anchor.href = downloadUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(downloadUrl)
  },
}
