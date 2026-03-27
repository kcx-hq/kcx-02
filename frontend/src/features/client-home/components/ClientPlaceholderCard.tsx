import type { ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"

type ClientPlaceholderCardProps = {
  title: string
  description: string
  icon?: ReactNode
}

export function ClientPlaceholderCard({ title, description, icon }: ClientPlaceholderCardProps) {
  return (
    <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
      <CardContent className="space-y-3 p-5">
        {icon ? (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary">
            {icon}
          </span>
        ) : null}
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        <p className="text-sm leading-6 text-text-secondary">{description}</p>
      </CardContent>
    </Card>
  )
}
