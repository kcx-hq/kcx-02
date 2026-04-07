import { Card, CardContent } from "@/shared/ui/card"

function MetricCard({ title, value, note }: { title: string; value: number; note: string }) {
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

export function BillingUploadsSummaryCards({
  total,
  processing,
  failed,
  completed,
}: {
  total: number
  processing: number
  failed: number
  completed: number
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Total" value={total} note="Current page" />
      <MetricCard title="Processing" value={processing} note="Current page" />
      <MetricCard title="Failed" value={failed} note="Current page" />
      <MetricCard title="Completed" value={completed} note="Current page" />
    </div>
  )
}
