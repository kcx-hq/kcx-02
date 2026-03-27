import { ArrowUpRight, Minus } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

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
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:rgba(160,175,188,0.82)]">
              {label}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-[-0.03em]">{value}</div>
          </div>
          <div
            className={cn(
              "grid h-10 w-10 place-items-center rounded-xl ring-1",
              trend === "up"
                ? "bg-[color:rgba(62,138,118,0.12)] text-[color:rgba(172,238,214,0.95)] ring-[color:rgba(118,177,157,0.20)]"
                : "bg-[color:rgba(255,255,255,0.03)] text-[color:rgba(200,214,224,0.92)] ring-[color:rgba(255,255,255,0.10)]"
            )}
            aria-hidden="true"
          >
            {trend === "up" ? <ArrowUpRight className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
          </div>
        </div>
        <div className="mt-2 text-sm text-text-on-dark-muted">{helper}</div>
      </CardContent>
    </Card>
  )
}

