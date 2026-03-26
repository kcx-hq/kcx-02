import { ArrowRight, Wallet, SlidersHorizontal, ShieldCheck, Lightbulb } from "lucide-react"

const valuePoints = [
  "Secure read-only AWS connection",
  "Streamlined ingestion and normalized processing",
  "Clear optimization signals and reporting outcomes",
]

function AwsVisualCard() {
  return (
    <div className="relative">
      {/* Atmosphere glow */}
      <div className="pointer-events-none absolute -inset-6 bg-[radial-gradient(60%_50%_at_50%_50%,rgba(62,138,118,0.05),transparent_70%)]" />

      {/* Card */}
      <div className="relative overflow-hidden rounded-2xl border border-[rgba(170,200,192,0.25)] bg-[#0C1820] shadow-[0_24px_64px_-16px_rgba(8,20,28,0.5)]">

        {/* Window chrome */}
        <div className="flex items-center gap-1.5 border-b border-[rgba(255,255,255,0.06)] px-5 py-3">
          <span className="h-[9px] w-[9px] rounded-full bg-[#E5E8E7] opacity-40" />
          <span className="h-[9px] w-[9px] rounded-full bg-[#E5E8E7] opacity-40" />
          <span className="h-[9px] w-[9px] rounded-full bg-[#E5E8E7] opacity-40" />
        </div>

        {/* Config-like content — matches right-side text narrative */}
        <div className="px-6 py-5 font-mono text-[12.5px] leading-[2]">
          {/* Connection block */}
          <p className="text-[#3E8A76] font-semibold">Connection:</p>
          <p className="ml-4"><span className="text-[#5A7A70]">Provider:</span> <span className="text-[#D4E0DC]">AWS</span></p>
          <p className="ml-4"><span className="text-[#5A7A70]">Access:</span> <span className="text-[#8BB0A4]">read-only</span></p>
          <p className="ml-4"><span className="text-[#5A7A70]">Auth:</span> <span className="text-[#D4E0DC]">IAM Cross-Account Role</span></p>
          <p className="ml-4"><span className="text-[#5A7A70]">Security:</span> <span className="text-[#8BB0A4]">external_id_verified</span></p>

          {/* Ingestion block */}
          <p className="mt-3 text-[#3E8A76] font-semibold">Ingestion:</p>
          <p className="ml-4"><span className="text-[#5A7A70]">Source:</span> <span className="text-[#D4E0DC]">CUR · Cost Explorer · CloudWatch</span></p>
          <p className="ml-4"><span className="text-[#5A7A70]">Normalize:</span> <span className="text-[#8BB0A4]">enabled</span></p>
          <p className="ml-4"><span className="text-[#5A7A70]">Enrich:</span> <span className="text-[#D4E0DC]">usage_context</span></p>

          {/* Signals block */}
          <p className="mt-3 text-[#3E8A76] font-semibold">Signals:</p>
          <p className="ml-4"><span className="text-[#5A7A70]">-</span> <span className="text-[#D4E0DC]">spend_visibility</span></p>
          <p className="ml-4"><span className="text-[#5A7A70]">-</span> <span className="text-[#D4E0DC]">rightsizing_alerts</span></p>
          <p className="ml-4"><span className="text-[#5A7A70]">-</span> <span className="text-[#D4E0DC]">idle_resource_flags</span></p>
          <p className="ml-4"><span className="text-[#5A7A70]">-</span> <span className="text-[#8BB0A4]">optimization_signals</span></p>
        </div>

        {/* Bottom abstract visualization bar */}
        <div className="grid grid-cols-4 gap-3 border-t border-[rgba(255,255,255,0.06)] px-6 py-5">
          {[
            { icon: Wallet, label: "Cost Management" },
            { icon: SlidersHorizontal, label: "Optimization" },
            { icon: ShieldCheck, label: "Governance" },
            { icon: Lightbulb, label: "Insights" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[rgba(62,138,118,0.18)] bg-[rgba(62,138,118,0.08)] transition-colors hover:bg-[rgba(62,138,118,0.14)]">
                <Icon className="h-[22px] w-[22px] text-[#3E8A76]" strokeWidth={1.6} />
              </div>
              <span className="text-[11px] font-semibold text-[#D4E0DC]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AwsValueSection() {
  return (
    <section
      data-header-theme="light"
      className="relative overflow-hidden border-y border-[rgba(200,218,212,0.42)] bg-[#F5F8F7] py-24 lg:py-32"
    >
      <div className="relative mx-auto w-full max-w-7xl px-6 md:px-10 lg:px-12">
        <div className="grid items-center gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">

          {/* ── LEFT: Visual Card ── */}
          <AwsVisualCard />

          {/* ── RIGHT: Text ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#3E8A76] mb-4">
              Secure AWS Cost Intelligence
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-[#0F1F1A] leading-[1.2] sm:text-4xl">
              Turn AWS data into clarity, control, and cost confidence
            </h2>
            <p className="mt-5 text-[15px] leading-[1.8] text-[#4A6058]">
              KCX connects securely to AWS, ingests key billing and usage context,
              and translates it into clear operational and optimization insight
              without adding setup friction.
            </p>

            <div className="mt-8 space-y-4">
              {valuePoints.map((point) => (
                <div key={point} className="flex items-center gap-3">
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#3E8A76]" />
                  <p className="text-[14.5px] text-[#2D443D]">{point}</p>
                </div>
              ))}
            </div>

            <p className="mt-8 text-sm text-[#7A9B91]">
              A lightweight integration experience with enterprise-grade confidence.
            </p>
          </div>

        </div>
      </div>
    </section>
  )
}