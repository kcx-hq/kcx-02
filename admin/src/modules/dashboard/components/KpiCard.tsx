import { ArrowUpRight, Minus } from "lucide-react"

import { Card, CardContent } from "@/shared/ui/card"
import { cn } from "@/shared/utils"

type KpiCardProps = {
  label: string
  value: string
  helper: string
  trend?: "up" | "flat"
}

export function KpiCard({ label, value, helper, trend = "flat" }: KpiCardProps) {
  return (
    <Card className="kcx-admin-card--interactive">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
            <div className="mt-3 text-3xl font-semibold tracking-[-0.03em]">{value}</div>
          </div>
          <div
            className={cn(
              "grid h-10 w-10 place-items-center rounded-xl ring-1",
              trend === "up"
                ? "bg-brand-primary-soft text-[color:rgba(38,107,90,0.98)] ring-[color:rgba(47,125,106,0.18)]"
                : "bg-white text-[color:rgba(15,23,42,0.78)] ring-[color:rgba(15,23,42,0.10)]"
            )}
            aria-hidden="true"
          >
            {trend === "up" ? <ArrowUpRight className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
          </div>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">{helper}</div>
      </CardContent>
    </Card>
  )
}
