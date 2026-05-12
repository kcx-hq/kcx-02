import { ArrowRight, CalendarCheck2, Compass, ShieldCheck } from "lucide-react"
import { Reveal } from "@/components/motion/Reveal"
import { handleAppLinkClick } from "@/lib/navigation"
import { landingSectionIds } from "@/features/landing/utils/landingSectionIds"

const ctaRows = [
  "A walkthrough of the right onboarding path for your current billing environment",
  "A review of how KCX validates and scopes cloud cost data",
  "A view of budgets, anomalies, and optimization workflows in practice",
  "A discussion of where selected AWS actions can be executed safely",
]

export function EnterpriseCTA() {
  return (
    <section
      id={landingSectionIds.enterpriseCta}
      data-header-theme="light"
      className="kcx-section kcx-section-light relative overflow-hidden"
    >
      <div className="kcx-section-mist" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-20">
        <div className="kcx-container max-w-[1220px]">
          <span className="block h-px w-full bg-[linear-gradient(90deg,rgba(63,114,99,0)_0%,rgba(63,114,99,0.42)_52%,rgba(63,114,99,0)_100%)]" />
        </div>
      </div>

      <div className="kcx-container relative z-10 w-full">
        <div className="grid gap-10 sm:gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center">
          <Reveal className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2f7f67]">Ready to Start</p>
            <h2 className="kcx-heading mt-4 max-w-4xl text-[1.85rem] font-semibold tracking-tight text-[#10231d] sm:text-4xl md:text-[2.65rem] md:leading-[1.14] lg:text-[3rem]">
              Build a trusted FinOps operating model with KCX
            </h2>
            <p className="mt-5 max-w-3xl text-[15px] leading-[1.7] text-[#3f5d55] sm:text-base sm:leading-[1.75]">
              Move from fragmented billing inputs to validated cost intelligence, prioritized
              optimization, and selected AWS action workflows from one enterprise workspace.
            </p>
            <p className="mt-5 max-w-3xl text-[15px] leading-[1.7] text-[#4f6660] sm:mt-6 sm:text-base sm:leading-[1.75]">
              The first conversation should help your team understand which onboarding path fits
              your environment, how KCX structures cost intelligence, and where your highest-value
              optimization workflows can become more operational.
            </p>

            <div className="mt-8 hidden gap-3 sm:flex lg:flex-row lg:items-center">
              <a
                href="/schedule-demo"
                onClick={(event) => handleAppLinkClick(event, "/schedule-demo")}
                className="inline-flex items-center justify-center gap-2 !rounded-none [border-radius:0!important] bg-brand-primary px-6 py-3 text-[0.9rem] font-semibold text-white shadow-[0_16px_32px_-18px_rgba(31,128,104,0.65),inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-primary-hover hover:shadow-[0_22px_40px_-18px_rgba(31,128,104,0.8)]"
              >
                Schedule a Demo
                <CalendarCheck2 className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="group inline-flex items-center justify-center gap-1.5 !rounded-none [border-radius:0!important] border border-[rgba(88,145,125,0.36)] bg-white/80 px-6 py-3 text-[0.9rem] font-semibold text-[#205444] shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(88,145,125,0.52)] hover:bg-white hover:shadow-[0_8px_20px_rgba(15,23,42,0.1)]"
              >
                Explore Platform
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>
            </div>
          </Reveal>

          <Reveal className="relative" delay={0.1}>
            <div className="pointer-events-none absolute -left-6 top-6 hidden h-[72%] w-px bg-[linear-gradient(180deg,rgba(60,138,116,0)_0%,rgba(60,138,116,0.35)_24%,rgba(60,138,116,0.2)_72%,rgba(60,138,116,0)_100%)] lg:block" />
            <p className="inline-flex items-center gap-2 rounded-none border border-[rgba(118,180,160,0.42)] bg-[rgba(238,248,244,0.88)] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-[#286a56] shadow-[0_2px_6px_rgba(15,23,42,0.04)]">
              <Compass className="h-3.5 w-3.5" />
              What teams get in a first session
            </p>

            <div className="mt-5 space-y-3">
              {ctaRows.map((row) => (
                <div
                  key={row}
                  className="flex items-start gap-3 rounded-none border border-[rgba(123,187,167,0.34)] bg-[linear-gradient(120deg,rgba(255,255,255,0.88),rgba(248,253,250,0.72))] px-4 py-3.5 shadow-[0_2px_6px_rgba(15,23,42,0.04)] backdrop-blur-[2px] transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(94,170,146,0.52)] hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] sm:px-5"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2f7f67]" />
                  <p className="text-[13px] leading-[1.6] text-[#3a5a50] sm:text-[14px]">{row}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.14} className="mt-7 flex flex-col gap-3 sm:hidden">
          <a
            href="/schedule-demo"
            onClick={(event) => handleAppLinkClick(event, "/schedule-demo")}
            className="inline-flex w-full items-center justify-center gap-2 !rounded-none [border-radius:0!important] bg-brand-primary px-5 py-3.5 text-[0.9rem] font-semibold text-white shadow-[0_16px_32px_-18px_rgba(31,128,104,0.65),inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-primary-hover"
          >
            Schedule a Demo
            <CalendarCheck2 className="h-4 w-4" />
          </a>
          <a
            href="#"
            className="inline-flex w-full items-center justify-center gap-1.5 !rounded-none [border-radius:0!important] border border-[rgba(88,145,125,0.36)] bg-white/80 px-5 py-3.5 text-[0.9rem] font-semibold text-[#205444] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white"
          >
            Explore Platform
            <ArrowRight className="h-4 w-4" />
          </a>
        </Reveal>
      </div>
    </section>
  )
}

