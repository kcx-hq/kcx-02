import { Upload, Link2, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

type BillingHubSectionProps = {
  onOpenLocalUploadModal: () => void
  onOpenUploadHistory: () => void
  onOpenConnectCloud: () => void
}

export function BillingHubSection({
  onOpenLocalUploadModal,
  onOpenUploadHistory,
  onOpenConnectCloud,
}: BillingHubSectionProps) {
  return (
    <section aria-label="Billing ingestion" className="space-y-8">
      <div className="border-b border-[color:var(--border-light)]" />

      <section className="space-y-5">
        <div className="space-y-2">
          <p className="kcx-eyebrow text-brand-primary">Billing Ingestion</p>
          <h2 className="text-3xl font-semibold tracking-tight text-text-primary">Choose how you want to add billing data</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <article className="group relative overflow-hidden rounded-2xl border border-[color:var(--border-light)] bg-[linear-gradient(155deg,#ffffff_0%,#f8fbfa_45%,#f2f7f5_100%)] p-6 shadow-sm-custom transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(12,31,26,0.12)]">
            <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(62,143,120,0.18)_0%,rgba(62,143,120,0)_70%)]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,rgba(63,136,115,0)_0%,rgba(63,136,115,0.35)_50%,rgba(63,136,115,0)_100%)]" />

            <div className="relative flex items-start gap-4">
              <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[rgba(63,136,115,0.2)] bg-[rgba(226,241,236,0.88)] text-brand-primary">
                <Upload className="h-8 w-8" />
              </span>
              <div className="space-y-2">
                <h3 className="text-3xl font-semibold tracking-tight text-text-primary">Upload from Local</h3>
                <p className="max-w-sm text-sm leading-6 text-text-secondary">
                  Import billing files directly from your device for immediate ingestion.
                </p>
              </div>
            </div>

            <div className="relative mt-8 border-t border-[rgba(140,173,163,0.35)] pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="outline"
                  className="h-10 rounded-full border-[color:var(--kcx-border-soft)] bg-white px-6 text-sm font-medium text-text-primary hover:border-[color:var(--kcx-border-strong)]"
                  onClick={onOpenUploadHistory}
                >
                  History
                </Button>
                <Button
                  className="h-10 rounded-full px-6 text-sm font-semibold"
                  onClick={onOpenLocalUploadModal}
                >
                  Upload
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </article>

          <article className="group relative overflow-hidden rounded-2xl border border-[color:var(--kcx-border-soft)] bg-[linear-gradient(145deg,#f6fcf9_0%,#edf7f3_48%,#ffffff_100%)] p-6 shadow-sm-custom transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(12,31,26,0.12)]">
            <div className="pointer-events-none absolute -left-10 -bottom-14 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(63,136,115,0.16)_0%,rgba(63,136,115,0)_70%)]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,rgba(63,136,115,0)_0%,rgba(63,136,115,0.4)_50%,rgba(63,136,115,0)_100%)]" />

            <div className="relative flex items-start gap-4">
              <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[rgba(63,136,115,0.25)] bg-[rgba(206,232,223,0.92)] text-brand-primary">
                <Link2 className="h-8 w-8" />
              </span>
              <div className="space-y-2">
                <h3 className="text-3xl font-semibold tracking-tight text-text-primary">Connect Cloud</h3>
                <p className="max-w-sm text-sm leading-6 text-text-secondary">
                  Link your cloud account once and keep billing data synced automatically.
                </p>
              </div>
            </div>

            <div className="relative mt-8 border-t border-[rgba(140,173,163,0.35)] pt-5">
              <div className="flex justify-end">
                <Button className="h-10 rounded-full px-7 text-sm font-semibold" onClick={onOpenConnectCloud}>
                  Connect
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </section>
  )
}
