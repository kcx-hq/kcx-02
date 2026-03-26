import { ArrowRight } from "lucide-react"

export function BlogNewsletterCta() {
  return (
    <section className="rounded-[1.5rem] border border-[#cddfd8] bg-[linear-gradient(135deg,#edf5f2_0%,#f8fbfa_54%,#eef8f4_100%)] p-7 shadow-[0_16px_32px_rgba(16,38,32,0.08)] md:p-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2f7f68]">FinOps Briefing</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary md:text-[2rem]">
            Get monthly FinOps benchmarks from high-performing cloud teams
          </h3>
          <p className="mt-3 text-sm leading-7 text-text-secondary md:text-base">
            Join the KCX briefing for practical guidance on spend optimization, governance policy trends, and
            engineering accountability frameworks.
          </p>
        </div>

        <a
          href="#"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Subscribe for updates
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  )
}

