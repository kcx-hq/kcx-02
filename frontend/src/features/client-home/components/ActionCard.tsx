import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type ActionCardStat = {
  label: string
  value: string
}

type ActionCardProps = {
  title: string
  description: string
  ctaLabel: string
  status?: ReactNode
  stats?: ActionCardStat[]
  emphasized?: boolean
}

export function ActionCard({ title, description, ctaLabel, status, stats = [], emphasized = false }: ActionCardProps) {
  return (
    <Card
      className={
        emphasized
          ? "rounded-md border-[color:var(--kcx-border-strong)] bg-[color:var(--kcx-card-light)] shadow-sm-custom"
          : "rounded-md border-[color:var(--border-light)] bg-[color:var(--kcx-card-light)] shadow-sm-custom"
      }
    >
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-lg text-text-primary">{title}</CardTitle>
        <CardDescription className="text-sm text-text-secondary">{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 p-6 pt-0">
        {stats.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {stats.map((item) => (
              <div key={item.label} className="rounded-md border border-[color:var(--border-muted)] bg-[color:var(--bg-surface)] p-3">
                <p className="text-xs text-text-muted">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-text-primary">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {status ? <div>{status}</div> : null}

        <Button className="h-11 rounded-md">{ctaLabel}</Button>
      </CardContent>
    </Card>
  )
}
