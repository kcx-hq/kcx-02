type CloudProviderComingSoonSectionProps = {
  cloudProviderName: string
}

export function CloudProviderComingSoonSection({ cloudProviderName }: CloudProviderComingSoonSectionProps) {
  return (
    <>
      <div className="space-y-2">
        <p className="kcx-eyebrow text-brand-primary">{cloudProviderName} Integration</p>
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary">{cloudProviderName} Setup</h2>
        <p className="text-sm text-text-secondary">
          Billing integration setup for {cloudProviderName} is coming soon.
        </p>
      </div>
      <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4 text-sm text-text-muted">
        This provider route is ready. Detailed onboarding steps for {cloudProviderName} will be added soon.
      </div>
    </>
  )
}
