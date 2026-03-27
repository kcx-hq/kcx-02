import { Card, CardContent } from "@/components/ui/card"

type StatCardProps = {
  title: string
  value: string
  subtext: string
  hasData: boolean
}

export function StatCard({ title, value, subtext, hasData }: StatCardProps) {
  return (
    <Card className="rounded-md border-[color:var(--border-light)] bg-[color:var(--kcx-card-light)] shadow-sm-custom">
      <CardContent className="p-5">
        <p className="kcx-eyebrow text-text-muted">{title}</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight text-text-primary">{hasData ? value : "No data yet"}</p>
        <div className="mt-3 h-px w-full bg-[color:var(--border-muted)]" />
        <p className="mt-3 text-sm leading-6 text-text-muted">{hasData ? subtext : "Trend available after data ingestion"}</p>
      </CardContent>
    </Card>
  )
}
