type ClientPageHeaderProps = {
  eyebrow: string
  title: string
  description: string
}

export function ClientPageHeader({ eyebrow, title, description }: ClientPageHeaderProps) {
  return (
    <section aria-label={`${title} header`} className="space-y-2">
      <p className="kcx-eyebrow text-brand-primary">{eyebrow}</p>
      <h1 className="kcx-heading text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
      <p className="max-w-3xl text-sm text-text-secondary">{description}</p>
    </section>
  )
}
