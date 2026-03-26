import { ArrowUpRight, CheckCircle2, Compass, Eye, ShieldCheck, Sparkles, Target } from "lucide-react"

const secondaryPillars = [
  {
    title: "Investigation Confidence",
    description: "Trace spend changes with explainable context before decisions are made.",
    icon: Compass,
    cue: "Root-cause workflows",
  },
  {
    title: "Governance Signals",
    description: "Combine data trust, ownership, and policy cues in one operating view.",
    icon: ShieldCheck,
    cue: "Validation before action",
  },
  {
    title: "Prioritized Action",
    description: "Rank cost opportunities by urgency, impact, and operational readiness.",
    icon: Target,
    cue: "Decision-ready queue",
  },
  {
    title: "Explainable Intelligence",
    description: "Present visibility with narrative context that teams can audit and align on.",
    icon: CheckCircle2,
    cue: "Confidence across stakeholders",
  },
]

const proofRows = [
  "Trusted visibility across products, services, and owners",
  "Investigation workflows tuned for finance and engineering alignment",
  "Prioritization that balances savings opportunity and execution feasibility",
]

export function HowKCXHelps() {
  return (
    <section
      data-header-theme="dark"
      className="relative overflow-hidden border-y border-[rgba(118,185,165,0.24)] bg-[linear-gradient(180deg,#071119_0%,#091722_36%,#0a1823_100%)] py-20 md:py-24"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(66%_44%_at_82%_18%,rgba(80,172,145,0.16),transparent_72%),radial-gradient(52%_40%_at_14%_76%,rgba(65,120,177,0.14),transparent_74%)]" />

      <div className="relative mx-auto w-full max-w-[1320px] px-6 md:px-10 lg:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(160,235,213,0.86)]">
            Value Pillars
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-[2.5rem] md:leading-[1.12]">
            Strategic cost intelligence for teams that need trusted decisions
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-[rgba(202,225,218,0.8)] sm:text-base sm:leading-8">
            KCX combines structured visibility, governance signals, and prioritization logic so teams
            can move from analysis delay to confident operational action.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <article className="relative overflow-hidden rounded-[1.6rem] border border-[rgba(120,193,171,0.34)] bg-[linear-gradient(150deg,rgba(9,26,35,0.92),rgba(13,32,42,0.9))] p-6 shadow-[0_30px_60px_-38px_rgba(3,12,20,0.95)] md:p-7">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(85,182,154,0.16)_0%,rgba(59,135,191,0.14)_48%,rgba(8,20,28,0.08)_100%)]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(138,219,195,0.34)] bg-[rgba(9,33,43,0.72)] px-3 py-1.5">
                <Eye className="h-4 w-4 text-[rgba(170,240,220,0.94)]" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[rgba(173,239,219,0.9)]">
                  Primary Pillar
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-semibold text-white md:text-[1.95rem] md:leading-[1.2]">
                Trusted Visibility
              </h3>
              <p className="mt-4 text-sm leading-7 text-[rgba(214,236,229,0.88)] sm:text-base sm:leading-8">
                Build a reliable, explainable view of cloud spend across services, ownership, and business
                scope. KCX turns fragmented inputs into a cost narrative that teams can trust and act on.
              </p>

              <div className="mt-5 grid gap-2.5">
                {proofRows.map((row) => (
                  <div
                    key={row}
                    className="flex items-start gap-2.5 rounded-lg border border-[rgba(127,204,182,0.28)] bg-[rgba(10,29,39,0.72)] px-3.5 py-2.5"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[rgba(160,235,213,0.9)]" />
                    <p className="text-sm leading-6 text-[rgba(214,235,228,0.9)]">{row}</p>
                  </div>
                ))}
              </div>

              <p className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-[rgba(167,236,215,0.92)]">
                Confidence-first operating layer
                <ArrowUpRight className="h-3.5 w-3.5" />
              </p>
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {secondaryPillars.map((pillar) => (
              <article
                key={pillar.title}
                className="rounded-2xl border border-[rgba(122,194,173,0.32)] bg-[linear-gradient(155deg,rgba(10,25,34,0.84),rgba(9,20,30,0.84))] p-4 shadow-[0_16px_32px_-24px_rgba(2,12,18,0.86)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(148,225,201,0.46)]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg border border-[rgba(132,211,188,0.4)] bg-[rgba(11,38,48,0.75)] p-2">
                    <pillar.icon className="h-4 w-4 text-[rgba(169,241,220,0.92)]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{pillar.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-[rgba(203,229,221,0.82)]">{pillar.description}</p>
                <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(166,236,214,0.88)]">
                  <Sparkles className="h-3.5 w-3.5" />
                  {pillar.cue}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
