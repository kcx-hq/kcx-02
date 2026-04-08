import { Button } from "@/components/ui/button"

type AddCloudConnectionSectionProps = {
  onAutomaticSetup: () => void
  onManualSetup: () => void
}

export function AddCloudConnectionSection({
  onAutomaticSetup,
  onManualSetup,
}: AddCloudConnectionSectionProps) {
  return (
    <>
      <div className="space-y-1">
        <p className="kcx-eyebrow text-brand-primary">Cloud Connections</p>
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Add Cloud Connection</h2>
        <p className="text-sm text-text-secondary">
          Choose your AWS setup path to start automated billing ingestion.
        </p>
      </div>

      <section className="rounded-md border border-[color:var(--border-light)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbfa_100%)] p-4 md:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <div className="rounded-md border border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] p-6">
            <div className="flex h-full flex-col items-center justify-center gap-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-primary">Amazon Web Services</span>
              <img src="/aws.svg" alt="AWS cloud connection" className="h-20 w-20 object-contain md:h-24 md:w-24" />
              <p className="max-w-md text-center text-sm leading-6 text-text-secondary">
                Securely connect your AWS billing source with guided onboarding and dashboard-ready scoping.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-[color:var(--border-light)] bg-white p-5 md:p-6">
            <div className="flex h-full flex-col justify-center gap-4">
              <h3 className="text-lg font-semibold text-text-primary">Setup Options</h3>
              <p className="text-sm text-text-secondary">Pick how you want to configure AWS integration.</p>

              <div className="flex flex-col gap-3">
                <Button className="h-11 rounded-md justify-start px-4 text-left" onClick={onAutomaticSetup}>
                  Connect Automatic Setup
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-md justify-start border-[color:var(--border-light)] px-4 text-left"
                  onClick={onManualSetup}
                >
                  Connect Manual Setup
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
