import { ArrowRight, BarChart3, BellRing, Database, ShieldCheck, Sparkles } from "lucide-react"

const capabilities = [
  {
    title: "Unified Cost View",
    description: "Combine billing, usage, and ownership context into one operating view for finance and engineering.",
    icon: Database,
  },
  {
    title: "Actionable Optimization",
    description: "Surface rightsizing, idle resource, and anomaly opportunities with clear next-step guidance.",
    icon: Sparkles,
  },
  {
    title: "Policy and Guardrails",
    description: "Apply spend controls and governance checks before surprises show up at month-end.",
    icon: ShieldCheck,
  },
  {
    title: "Reporting Signals",
    description: "Turn raw AWS data into stakeholder-ready summaries for teams, owners, and leadership.",
    icon: BarChart3,
  },
]

const systemFlow = [
  "Ingest AWS billing and usage sources",
  "Normalize and map costs by service, team, and owner",
  "Generate optimization and governance signals",
  "Deliver insights as operational decisions",
]

export function AwsSystemCapabilitiesSection() {
  return (
    <section
      data-header-theme="light"
      className="relative overflow-hidden border-b border-[rgba(196,214,208,0.5)] bg-[linear-gradient(180deg,#eef4f2_0%,#f8fbfa_100%)] py-24 lg:py-28"
    >
      <div className="mx-auto w-full max-w-7xl px-6 md:px-10 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#3e8a76]">System + Capabilities</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#0f1f1a] sm:text-4xl">
            A connected AWS FinOps system, built for action
          </h2>
          <p className="mt-5 text-[15px] leading-8 text-[#4a6058]">
            KCX operates as a decision layer across your AWS data. It structures cost intelligence into capabilities
            teams can use daily, not just reports they read monthly.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {capabilities.map(({ title, description, icon: Icon }) => (
            <article
              key={title}
              className="rounded-2xl border border-[rgba(173,197,190,0.35)] bg-white/92 p-6 shadow-[0_16px_40px_-28px_rgba(7,21,28,0.35)]"
            >
              <div className="flex items-start gap-4">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(62,138,118,0.2)] bg-[rgba(62,138,118,0.08)] text-[#2f7f68]">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-[#112520]">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#4d625c]">{description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-[rgba(167,195,186,0.4)] bg-[#f5f9f7] p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <BellRing className="h-4 w-4 text-[#3e8a76]" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#3e8a76]">Step Flow</p>
          </div>

          <div className="mt-6 flex items-center gap-3 overflow-x-auto pb-1">
            {systemFlow.map((step, index) => (
              <div key={step} className="flex items-center gap-3">
                <div className="w-[220px] shrink-0 rounded-xl border border-[rgba(170,198,190,0.36)] bg-white px-4 py-4 text-sm leading-6 text-[#2e4740] shadow-[0_14px_28px_-24px_rgba(9,30,40,0.45)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#679c8c]">Step {index + 1}</p>
                  <p className="mt-2 font-medium leading-6">{step}</p>
                </div>
                {index < systemFlow.length - 1 ? (
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#7ca79a]" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
