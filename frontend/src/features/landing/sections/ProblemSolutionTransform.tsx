import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Database,
  Gauge,
  ListChecks,
  ScanSearch,
  ShieldCheck,
  ShieldX,
  Split,
  TrendingUp,
} from "lucide-react"
import { Reveal } from "@/components/motion/Reveal"
import { landingSectionIds } from "@/features/landing/utils/landingSectionIds"

const problems = [
  { label: "Upload, S3, and cloud inputs remain disconnected", icon: Split },
  { label: "Static cost reports are hard to operationalize", icon: ScanSearch },
  { label: "Data confidence gaps slow governance", icon: ShieldX },
  { label: "Spend changes are slow to investigate", icon: AlertTriangle },
  { label: "Optimization lacks clear prioritization", icon: Gauge },
]

const intelligence = [
  { label: "Upload, import, and connect onboarding paths", icon: Database },
  { label: "Validate, normalize, and aggregate processing", icon: ListChecks },
  { label: "Warehouse-backed trusted analytics", icon: ShieldCheck },
  { label: "Budgets and anomaly detection in one layer", icon: ShieldCheck },
  { label: "Accountable optimization and action workflows", icon: TrendingUp },
]

const outcomes = [
  { label: "Shared visibility for finance, FinOps, and platform teams", icon: CheckCircle2 },
  { label: "Faster investigation with trusted spend context", icon: TrendingUp },
  { label: "Clearer budget and anomaly operations", icon: ShieldCheck },
  { label: "Prioritized optimization execution", icon: ScanSearch },
  { label: "More accountable FinOps governance", icon: ListChecks },
]

function PremiumCornerNetwork() {
  return (
    <div
      className="pointer-events-none absolute -right-4 top-[36%] z-[1] hidden opacity-90 lg:block"
      aria-hidden
    >
      <svg
        width="260"
        height="200"
        viewBox="0 0 260 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        {/* Soft background glow */}
        <defs>
          <radialGradient id="glow1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(80,172,145,0.12)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(132,200,180,0.06)" />
            <stop offset="50%" stopColor="rgba(132,200,180,0.22)" />
            <stop offset="100%" stopColor="rgba(132,200,180,0.06)" />
          </linearGradient>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(80,172,145,0.14)" />
            <stop offset="100%" stopColor="rgba(80,172,145,0)" />
          </linearGradient>
        </defs>

        <ellipse cx="130" cy="100" rx="110" ry="80" fill="url(#glow1)" />

        {/* Grid dots pattern */}
        <g fill="rgba(132,186,170,0.1)">
          {[0,1,2,3,4,5,6,7].map(col =>
            [0,1,2,3,4,5].map(row => (
              <circle key={`${col}-${row}`} cx={30 + col * 30} cy={20 + row * 30} r="1" />
            ))
          )}
        </g>

        {/* Main analytics path line */}
        <path
          d="M 20 140 C 50 130, 60 100, 90 95 C 120 90, 130 60, 150 55 C 170 50, 180 70, 200 40 C 220 10, 235 30, 248 25"
          stroke="rgba(80,172,145,0.28)"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        {/* Area fill under curve */}
        <path
          d="M 20 140 C 50 130, 60 100, 90 95 C 120 90, 130 60, 150 55 C 170 50, 180 70, 200 40 C 220 10, 235 30, 248 25 L 248 160 L 20 160 Z"
          fill="url(#chartGrad)"
        />

        {/* Secondary dashed trend line */}
        <path
          d="M 30 120 L 248 35"
          stroke="rgba(150,204,189,0.14)"
          strokeWidth="0.8"
          strokeDasharray="4 6"
        />

        {/* Data point nodes on the main line */}
        <g>
          <circle cx="90" cy="95" r="4.5" fill="rgba(185,227,214,0.5)" />
          <circle cx="90" cy="95" r="2" fill="rgba(241,251,247,0.9)" />

          <circle cx="150" cy="55" r="5.5" fill="rgba(185,227,214,0.5)" />
          <circle cx="150" cy="55" r="2.5" fill="rgba(241,251,247,0.9)" />

          <circle cx="200" cy="40" r="4" fill="rgba(185,227,214,0.5)" />
          <circle cx="200" cy="40" r="1.8" fill="rgba(241,251,247,0.9)" />

          <circle cx="248" cy="25" r="5" fill="rgba(185,227,214,0.5)" />
          <circle cx="248" cy="25" r="2.2" fill="rgba(241,251,247,0.9)" />
        </g>

        {/* Connecting network lines between nodes */}
        <g stroke="rgba(132,186,170,0.16)" strokeWidth="1">
          <line x1="90" y1="95" x2="120" y2="130" />
          <line x1="150" y1="55" x2="180" y2="90" />
          <line x1="200" y1="40" x2="220" y2="75" />
          <line x1="120" y1="130" x2="180" y2="90" />
          <line x1="180" y1="90" x2="220" y2="75" />
        </g>

        {/* Secondary smaller nodes */}
        <g fill="rgba(203,239,229,0.35)">
          <circle cx="120" cy="130" r="3" />
          <circle cx="180" cy="90" r="3.2" />
          <circle cx="220" cy="75" r="2.8" />
        </g>

        {/* Decorative concentric rings */}
        <circle cx="150" cy="55" r="14" stroke="rgba(132,186,170,0.1)" strokeWidth="0.6" fill="none" />
        <circle cx="150" cy="55" r="22" stroke="rgba(132,186,170,0.06)" strokeWidth="0.5" fill="none" />

        {/* Small accent geometric diamond */}
        <g transform="translate(40,60) rotate(45)" stroke="rgba(150,204,189,0.15)" strokeWidth="0.8" fill="none">
          <rect x="-6" y="-6" width="12" height="12" rx="1" />
        </g>
        <g transform="translate(230,110) rotate(45)" stroke="rgba(150,204,189,0.12)" strokeWidth="0.8" fill="none">
          <rect x="-4" y="-4" width="8" height="8" rx="1" />
        </g>
      </svg>
    </div>
  )
}

export function ProblemSolutionTransform() {
  return (
    <section
      id={landingSectionIds.transformation}
      data-header-theme="light"
      className="kcx-section kcx-section-light relative overflow-hidden"
    >
      <div className="kcx-section-mist" />
      <PremiumCornerNetwork />

      <div className="kcx-container relative max-w-[1380px]">
        <Reveal className="mx-auto max-w-4xl text-center">
          <p className="inline-flex items-center rounded-none border border-[rgba(99,153,135,0.28)] bg-[rgba(232,243,238,0.82)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#327662] shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
            Transformation Model
          </p>

          <h2 className="kcx-heading mt-5 text-[1.75rem] font-semibold tracking-tight text-[#0F1F1A] sm:text-[2.2rem] md:text-[2.7rem] md:leading-[1.14]">
            From fragmented billing inputs to trusted cost intelligence
          </h2>

          <p className="mx-auto mt-5 max-w-3xl text-[0.9rem] leading-[1.7] text-[#516b63] sm:text-[0.95rem] sm:leading-[1.75]">
            KCX turns raw billing files, S3 imports, and guided cloud connections
            into validated, warehouse-backed analytics for faster investigation,
            clearer budgets, and confident action prioritization.
          </p>
        </Reveal>

        <div className="relative mt-14 overflow-visible sm:mt-16">
          <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_auto_minmax(0,1.24fr)_auto_minmax(0,1.08fr)] lg:items-stretch lg:gap-4 xl:gap-5">
            <Reveal className="h-full">
              <article className="group relative h-full overflow-hidden rounded-none border border-[rgba(145,195,176,0.36)] bg-[linear-gradient(160deg,rgba(248,252,250,0.98),rgba(240,248,244,0.94))] p-5 shadow-[0_2px_6px_rgba(15,23,42,0.04),0_16px_34px_-20px_rgba(33,74,62,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06),0_24px_42px_-22px_rgba(33,74,62,0.25)] md:min-h-[26.5rem]">
              <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(98,162,138,0.16)_0.8px,transparent_0.8px)] [background-size:12px_12px]" />
              <div className="absolute -left-8 top-8 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(83,170,142,0.16)_0%,transparent_66%)] blur-xl" />

              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4D7F6E]">
                  Current State
                </p>
                <h3 className="mt-2.5 text-[1.32rem] font-semibold text-[#142E25]">
                  Cloud Cost Friction
                </h3>
                <p className="mt-2 text-[0.9rem] leading-[1.65] text-[#3C6457]">
                  Billing inputs and analytics readiness are fragmented, creating
                  delays and stakeholder misalignment.
                </p>

                <ul className="mt-4 space-y-2.5">
                  {problems.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-start gap-2.5 text-[0.89rem] leading-[1.55] text-[#3a5e51]"
                    >
                      <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#2F7F68]" />
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
            </Reveal>

            <div className="flex items-center justify-center py-1 lg:py-0">
              <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(117,159,145,0.4)] bg-[rgba(238,247,243,0.94)] text-[#377A67] shadow-[0_4px_12px_-6px_rgba(15,37,32,0.3)]">
                <span className="absolute inset-0 rounded-full border border-[rgba(117,159,145,0.25)] motion-safe:animate-ping" />
                <ArrowRight className="hidden h-4 w-4 motion-safe:animate-pulse lg:block" />
                <ArrowDown className="block h-4 w-4 motion-safe:animate-pulse lg:hidden" />
              </span>
            </div>

            <Reveal delay={0.1} className="h-full">
              <article className="group relative h-full overflow-hidden rounded-none border border-[rgba(116,186,164,0.36)] bg-[linear-gradient(118deg,rgba(7,12,17,0.97)_0%,rgba(10,18,24,0.94)_32%,rgba(14,28,36,0.92)_62%,rgba(19,36,44,0.88)_100%)] p-5 text-[#E8F5F2] shadow-[0_4px_12px_rgba(0,0,0,0.2),0_24px_46px_-22px_rgba(11,26,37,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,0,0,0.25),0_28px_48px_-20px_rgba(9,30,41,0.68)] md:min-h-[26.5rem]">
              <div className="absolute inset-0 bg-[linear-gradient(112deg,rgba(22,44,56,0.14)_0%,rgba(29,101,83,0.1)_44%,rgba(34,72,97,0.08)_70%,rgba(10,20,28,0.06)_100%)]" />
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(96,196,163,0.16)_0%,transparent_72%)] blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-[linear-gradient(90deg,rgba(158,228,205,0)_0%,rgba(158,228,205,0.6)_52%,rgba(158,228,205,0)_100%)]" />

              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(180,225,209,0.72)]">
                  KCX Platform
                </p>
                <h3 className="mt-2.5 text-[1.32rem] font-semibold text-white">
                  Trusted Cost Intelligence Layer
                </h3>
                <p className="mt-2 text-[0.9rem] leading-[1.65] text-[rgba(211,234,226,0.8)]">
                  KCX provides a validated operating layer where ingestion,
                  normalization, and analytics become execution-ready.
                </p>

                <ul className="mt-4 space-y-2.5">
                  {intelligence.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-start gap-2.5 text-[0.89rem] leading-[1.55] text-[rgba(220,238,232,0.85)]"
                    >
                      <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-[rgba(145,221,195,0.9)]" />
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
            </Reveal>

            <div className="flex items-center justify-center py-1 lg:py-0">
              <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(117,159,145,0.4)] bg-[rgba(238,247,243,0.94)] text-[#377A67] shadow-[0_4px_12px_-6px_rgba(15,37,32,0.3)]">
                <span className="absolute inset-0 rounded-full border border-[rgba(117,159,145,0.25)] motion-safe:animate-ping" />
                <ArrowRight className="hidden h-4 w-4 motion-safe:animate-pulse lg:block" />
                <ArrowDown className="block h-4 w-4 motion-safe:animate-pulse lg:hidden" />
              </span>
            </div>

            <Reveal delay={0.2} className="h-full">
              <article className="group relative h-full overflow-hidden rounded-none border border-[rgba(171,206,193,0.48)] bg-[linear-gradient(160deg,rgba(250,253,252,0.98),rgba(243,250,247,0.95))] p-5 shadow-[0_2px_6px_rgba(15,23,42,0.04),0_20px_38px_-22px_rgba(27,63,53,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06),0_28px_44px_-24px_rgba(27,63,53,0.28)] md:min-h-[26.5rem]">
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4A7F6F]">
                  Business Impact
                </p>
                <h3 className="mt-2.5 text-[1.32rem] font-semibold tracking-tight text-[#1A2E28]">
                  Clearer FinOps Operations
                </h3>
                <p className="mt-2 text-[0.9rem] leading-[1.65] text-[#44675C]">
                  Teams move from visibility to accountable next steps with
                  stronger governance and operating cadence.
                </p>

                <ul className="mt-4 space-y-2.5">
                  {outcomes.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-start gap-2.5 text-[0.89rem] leading-[1.55] text-[#3a5e51]"
                    >
                      <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#2B7D65]" />
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}

