import kcxLogo from "@/assets/logos/kcx-logo.svg"
import { BackNavButton } from "@/features/landing/components/BackNavButton"
import { SplitHeroLeftPanel } from "@/features/landing/components/SplitHeroLeftPanel"
import { DemoRequestForm } from "@/features/landing/pages/demo/components/DemoRequestForm"

export function ScheduleDemoPage() {
  return (
    <section className="relative w-full min-h-[100svh] lg:h-[100svh] lg:overflow-hidden">
      <BackNavButton fallbackHref="/" className="absolute left-4 top-4 z-30 sm:left-6 sm:top-6 lg:left-8 lg:top-8" />

      <div className="grid min-h-[100svh] lg:h-[100svh] lg:grid-cols-[3fr_2fr]">
        {/* Left panel (dark, minimal) */}
        <SplitHeroLeftPanel className="px-6 py-12 sm:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-[40rem]">
            <div className="flex items-center gap-3">
              <img src={kcxLogo} alt="KCX" className="h-8 w-auto" />
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(214,230,226,0.75)]">
                Schedule demo
              </span>
            </div>

            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(170,225,207,0.88)]">
              Cloud cost clarity
            </p>
            <h1 className="kcx-heading mt-3 text-balance text-[2rem] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[2.35rem]">
              Turn cloud billing into actionable savings.
            </h1>
            <p className="mt-4 max-w-[58ch] text-sm leading-7 text-[rgba(214,230,226,0.78)]">
              A short walkthrough of how KCX helps teams find waste, detect anomalies, and build repeatable FinOps
              operating habits.
            </p>
          </div>
        </SplitHeroLeftPanel>

        {/* Right panel (light form) */}
        <main className="flex items-start bg-[#f3f7f5] px-6 py-12 text-[#0F1F1A] sm:px-10 lg:h-[100svh] lg:overflow-auto lg:px-12 lg:py-16">
          <div className="mx-auto w-full max-w-[42rem] rounded-[24px] border border-[rgba(15,31,26,0.12)] bg-white p-6 shadow-[0_10px_30px_rgba(15,31,26,0.06)] sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4f7f72]">Schedule Demo</p>
                <h2 className="mt-2 text-[1.85rem] font-semibold leading-tight tracking-[-0.02em] text-[#0F1F1A]">
                  Book Your KCX Walkthrough
                </h2>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 border-y border-[rgba(15,31,26,0.12)] py-3 sm:grid-cols-3">
              <div className="px-3 py-2 sm:border-r sm:border-[rgba(15,31,26,0.12)] sm:pl-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(15,31,26,0.56)]">Duration</p>
                <p className="mt-1 text-xl font-semibold text-[#0F1F1A]">30 min</p>
              </div>
              <div className="px-3 py-2 sm:border-r sm:border-[rgba(15,31,26,0.12)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(15,31,26,0.56)]">Format</p>
                <p className="mt-1 text-xl font-semibold text-[#0F1F1A]">Live Demo</p>
              </div>
              <div className="px-3 py-2 sm:pr-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(15,31,26,0.56)]">Includes</p>
                <p className="mt-1 text-xl font-semibold text-[#0F1F1A]">Q&A + Next Steps</p>
              </div>
            </div>

            <div className="mt-5">
              <DemoRequestForm tone="light" chrome="none" />
            </div>
          </div>
        </main>
      </div>
    </section>
  )
}
