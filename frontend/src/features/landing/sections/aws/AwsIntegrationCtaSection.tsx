import { KeyRound, Link2, Lock, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"

const integrationCore = [
  {
    title: "Cross-account IAM role",
    description: "Create a dedicated AWS role for KCX with scoped permissions and clear ownership boundaries.",
    icon: KeyRound,
  },
  {
    title: "Read-only access",
    description: "KCX reads billing and usage data only. No write operations, resource mutation, or service control.",
    icon: ShieldCheck,
  },
  {
    title: "External ID security",
    description: "Use external ID validation to protect role assumption and reduce cross-account access risk.",
    icon: Lock,
  },
]

const integrationFlow = ["Create role", "Authorize KCX", "Connect", "Ingest", "Process"]

export function AwsIntegrationCtaSection() {
  return (
    <section
      data-header-theme="dark"
      className="relative overflow-hidden bg-[linear-gradient(160deg,#081521_0%,#0b1e2d_52%,#102738_100%)] py-24 md:py-28"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:58px_58px]" />
      <div className="relative mx-auto w-full max-w-7xl px-6 md:px-10 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(152,222,199,0.92)]">
              Integration Core
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Secure AWS integration, clear by design
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-8 text-[rgba(218,233,228,0.88)]">
              Set up once with least-privilege principles, then let KCX continuously translate AWS data into usable
              cost intelligence.
            </p>

            <div className="mt-8 space-y-4">
              {integrationCore.map(({ title, description, icon: Icon }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-[rgba(175,214,201,0.2)] bg-[rgba(8,21,31,0.6)] px-5 py-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[rgba(123,191,169,0.28)] bg-[rgba(77,154,131,0.12)] text-[#82c5b1]">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-white">{title}</h3>
                      <p className="mt-1 text-sm leading-7 text-[rgba(207,226,219,0.86)]">{description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[rgba(172,211,198,0.24)] bg-[rgba(8,20,30,0.62)] p-6 md:p-7">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[#85ccb8]" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#97dcc8]">Integration Flow</p>
            </div>

            <div className="mt-6">
              {integrationFlow.map((step, index) => (
                <div key={step}>
                  <div className="cursor-default rounded-xl border border-[rgba(172,211,198,0.14)] bg-[rgba(14,31,43,0.42)] px-4 py-3 text-[rgba(223,237,232,0.94)]">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[rgba(168,207,194,0.28)] bg-[rgba(119,182,162,0.12)] px-2 text-[11px] font-semibold text-[#9ed6c6]">
                        {index + 1}
                      </span>
                      <p className="text-sm font-medium">{step}</p>
                    </div>
                  </div>
                  {index < integrationFlow.length - 1 ? (
                    <div className="ml-[15px] h-4 w-px bg-[rgba(152,197,183,0.36)]" />
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-10 border-t border-[rgba(171,209,197,0.2)] pt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(149,220,198,0.9)]">Next Step</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">Ready to connect AWS and move faster?</h3>
              <p className="mt-3 text-sm leading-7 text-[rgba(209,228,221,0.84)]">
                Start your integration and turn cost data into decisions your team can execute immediately.
              </p>
              <div className="mt-6 flex justify-center">
                <Button className="bg-[#3e8a76] px-6 text-white shadow-none hover:bg-[#357563] hover:shadow-none">
                  Book Demo
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
