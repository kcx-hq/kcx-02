import type { AdminCloudConnectionsListResponse } from "@/modules/cloud-connections/admin-cloud-connections.api"
import { Card, CardContent } from "@/shared/ui/card"

function MetricCard({
  title,
  value,
  note,
}: {
  title: string
  value: number
  note: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</div>
        <div className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[color:rgba(15,23,42,0.92)]">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{note}</div>
      </CardContent>
    </Card>
  )
}

type CloudConnectionsSummaryCardsProps = {
  summary: AdminCloudConnectionsListResponse["summary"]
}

export function CloudConnectionsSummaryCards({ summary }: CloudConnectionsSummaryCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard title="Total" value={summary.total} note="Filtered set" />
      <MetricCard title="Active" value={summary.active} note="Healthy integrations" />
      <MetricCard title="Failed" value={summary.failed} note="Needs investigation" />
      <MetricCard title="Suspended" value={summary.suspended} note="Disconnected state" />
      <MetricCard title="Source Missing" value={summary.billingSourceMissing} note="No linked billing source" />
    </div>
  )
}
