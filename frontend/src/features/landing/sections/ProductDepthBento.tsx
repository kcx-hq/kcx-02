import { Eye, Gauge, Layers2, ListChecks, Radar, ShieldCheck } from "lucide-react"

const capabilityDomains = [
  {
    title: "Visibility Layer",
    icon: Eye,
    summary: "Unified cloud spend visibility by service, owner, and product scope.",
    items: ["Cross-cloud cost mapping", "Scope-level trend analysis", "Attribution-ready views"],
    tone: "from-[#f2faf7] to-[#e6f2ee]",
  },
  {
    title: "Intelligence Layer",
    icon: Layers2,
    summary: "Explainable cost intelligence that turns billing data into operational signal.",
    items: ["Structured data normalization", "Driver-level context", "Signal confidence markers"],
    tone: "from-[#eef6fb] to-[#e6eff8]",
  },
  {
    title: "Investigation Layer",
    icon: Radar,
    summary: "Guided workflows to investigate anomalies, drift, and cost behavior changes.",
    items: ["Anomaly and drift tracking", "Root-cause exploration", "Validation checkpoints"],
    tone: "from-[#f8f7ff] to-[#eceef8]",
  },
  {
    title: "Governance Layer",
    icon: ShieldCheck,
    summary: "Trust cues and governance context embedded into analysis and decisions.",
    items: ["Ownership-aware visibility", "Policy and budget context", "Trust-state indicators"],
    tone: "from-[#f3fbf8] to-[#e8f4ef]",
  },
  {
    title: "Action Layer",
    icon: Gauge,
    summary: "Prioritized actions and optimization pathways tied to execution readiness.",
    items: ["Impact-ranked opportunities", "Action routing by owner", "Execution status context"],
    tone: "from-[#f9f8f3] to-[#f2efe5]",
  },
  {
    title: "Reporting Layer",
    icon: ListChecks,
    summary: "Stakeholder-ready cost narratives for finance, platform, and leadership teams.",
    items: ["Executive-ready summaries", "Cross-team alignment views", "Review cycle evidence"],
    tone: "from-[#f4faf9] to-[#eaf2f0]",
  },
]

export function ProductDepthBento() {
  return (
    <section
      data-header-theme="light"
      className="relative overflow-hidden bg-[linear-gradient(180deg,#EFF4F1_0%,#F5F8F7_100%)] py-20 md:py-24"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(48%_36%_at_14%_18%,rgba(96,152,133,0.12),transparent_72%),radial-gradient(40%_30%_at_86%_80%,rgba(74,131,176,0.09),transparent_72%)]" />

      <div className="relative mx-auto w-full max-w-[1320px] px-6 md:px-10 lg:px-12">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#3A7D6A]">
            Capabilities Architecture
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#10211C] sm:text-4xl md:text-[2.45rem] md:leading-[1.12]">
            Platform breadth organized as a decision intelligence system
          </h2>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-[#445A53] sm:text-base sm:leading-8">
            KCX capabilities are designed as connected operating layers so teams can move from visibility
            to action with confidence, speed, and governance context.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {capabilityDomains.map((domain) => (
            <article
              key={domain.title}
              className={`group overflow-hidden rounded-2xl border border-[rgba(152,184,171,0.44)] bg-gradient-to-br ${domain.tone} p-5 shadow-[0_16px_34px_-24px_rgba(16,35,29,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_42px_-24px_rgba(16,35,29,0.26)] md:p-6`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-xl border border-[rgba(137,177,162,0.44)] bg-white/85 p-2.5">
                  <domain.icon className="h-5 w-5 text-[#2F7F68]" />
                </div>
                <span className="rounded-full border border-[rgba(137,177,162,0.44)] bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#44695D]">
                  Domain
                </span>
              </div>

              <h3 className="mt-4 text-xl font-semibold text-[#122720]">{domain.title}</h3>
              <p className="mt-2.5 text-sm leading-7 text-[#3D554D]">{domain.summary}</p>

              <ul className="mt-4 space-y-2">
                {domain.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-[#3C564E]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3A8A74]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
