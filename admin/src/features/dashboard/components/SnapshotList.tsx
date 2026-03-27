import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export type SnapshotRow = {
  title: string
  meta: string
  status: { label: string; variant?: "subtle" | "warning" | "outline" }
}

export function SnapshotList({
  title,
  description,
  rows,
}: {
  title: string
  description: string
  rows: SnapshotRow[]
}) {
  return (
    <Card className="kcx-admin-card--interactive">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-[color:rgba(15,23,42,0.08)]">
          {rows.map((row) => (
            <div key={`${row.title}-${row.meta}`} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{row.title}</div>
                <div className="truncate text-xs text-muted-foreground">{row.meta}</div>
              </div>
              <Badge className="shrink-0" variant={row.status.variant ?? "outline"}>
                {row.status.label}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
