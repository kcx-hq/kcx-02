import type { ReactNode } from "react"

type ClientPageHeaderProps = {
  eyebrow: string
  title: ReactNode
  description: string
}

export function ClientPageHeader({ eyebrow, title, description }: ClientPageHeaderProps) {
  const ariaLabel = typeof title === "string" ? `${title} header` : "Page header"

  return (
    <section aria-label={ariaLabel} className="space-y-2">
      <p className="kcx-eyebrow text-brand-primary">{eyebrow}</p>
      <h1 className="kcx-heading text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
      <p className="max-w-3xl text-sm text-text-secondary">{description}</p>
    </section>
  )
}
